import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

const FITOGETHER_PROFILE = `
회사명: 주식회사 핏투게더
업종: SW개발업, 전자장비개발업, 제조업
기업유형: 중소기업, 벤처기업, 이노비즈
직원수: 30명, 연매출: 32.4억원
주요사업: EPTS 웨어러블 기기, 스포츠 팀/선수 데이터 관리, 생체데이터 AI 분석, 경기력 향상 솔루션
인증: 벤처기업, 이노비즈, 기업부설연구소, ISO9001, FIFA Quality인증, World Rugby인증
해외매출 75%, 주요기술: IoT 센서, 웨어러블, AI/ML, 빅데이터, 스포츠 과학
목표: 2027년 코스닥 기술특례상장
`

// GET: 저장된 추천 공고 조회
export async function GET() {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('recommendations')
    .select('*')
    .order('match_score', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// POST: 중기부 + KOCCA API에서 최신 공고 가져와서 AI 스코어링
export async function POST() {
  const mssKey = process.env.MSS_API_KEY
  const koccaKey = process.env.MCST_API_KEY
  const anthropicKey = process.env.ANTHROPIC_API_KEY

  if (!anthropicKey || anthropicKey === '여기에_키_입력') {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY 없음' }, { status: 400 })
  }

  try {
    const today = new Date()
    const fmt = (d: Date) => d.toISOString().slice(0, 10)
    const todayStr = fmt(today)

    // 두 소스 병렬 fetch
    const [mssItems, koccaItems] = await Promise.all([
      mssKey ? fetchMssItems(mssKey, today, fmt) : Promise.resolve([]),
      koccaKey ? fetchKoccaItems(koccaKey) : Promise.resolve([]),
    ])

    const allItems = [...mssItems, ...koccaItems]

    if (allItems.length === 0) {
      return NextResponse.json({ message: '공고가 없습니다.', count: 0 })
    }

    // 마감일 지난 것 제외
    const validItems = allItems.filter(i => !i.deadline || i.deadline >= todayStr)

    // Claude AI 스코어링
    const scored = await scoreWithClaude(validItems.slice(0, 50), anthropicKey)

    // Supabase 저장 (오늘 이미 있는 제목 제외)
    if (scored.length > 0) {
      const supabase = getSupabase()
      const { data: existing } = await supabase
        .from('recommendations')
        .select('title')
        .gte('fetched_at', todayStr)
        .neq('source', 'demo')

      const existingTitles = new Set((existing ?? []).map((e: { title: string }) => e.title))
      const newItems = scored.filter(s => !existingTitles.has(s.title))

      if (newItems.length > 0) {
        await supabase.from('recommendations').insert(newItems)
      }

      return NextResponse.json({
        message: `중기부 ${mssItems.length}개 + KOCCA ${koccaItems.length}개 분석 → ${scored.length}개 매칭 (40점 이상)`,
        count: scored.length,
        new: newItems.length
      })
    }

    return NextResponse.json({ message: '매칭 공고 없음', count: 0 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : '오류'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

async function fetchMssItems(mssKey: string, today: Date, fmt: (d: Date) => string): Promise<RawItem[]> {
  const startDate = new Date(today)
  startDate.setDate(today.getDate() - 60)

  const url = new URL('https://apis.data.go.kr/1421000/mssBizService_v2/getbizList_v2')
  url.searchParams.set('serviceKey', mssKey)
  url.searchParams.set('pageNo', '1')
  url.searchParams.set('numOfRows', '50')
  url.searchParams.set('startDate', fmt(startDate))
  url.searchParams.set('endDate', fmt(today))

  const res = await fetch(url.toString())
  const text = await res.text()
  return parseXmlItems(text)
}

async function fetchKoccaItems(koccaKey: string): Promise<RawItem[]> {
  const url = new URL('https://kocca.kr/api/pims/List.do')
  url.searchParams.set('serviceKey', koccaKey)
  url.searchParams.set('pageIndex', '1')
  url.searchParams.set('pageUnit', '50')

  const res = await fetch(url.toString())
  const json = await res.json()

  const list = json?.INFO?.list ?? []
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')

  return list
    .filter((item: KoccaItem) => item.title)
    .map((item: KoccaItem) => ({
      title: item.title,
      description: item.content ?? '',
      deadline: item.endDt ?? '',
      startDate: item.startDt ?? '',
      ministry: '한국콘텐츠진흥원(KOCCA)',
      url: item.link ? `https://${item.link}` : '',
    }))
    .filter((i: RawItem) => !i.deadline || i.deadline >= today)
}

function parseXmlItems(xml: string): RawItem[] {
  const items: RawItem[] = []
  const itemMatches = xml.match(/<item>([\s\S]*?)<\/item>/g) ?? []

  for (const block of itemMatches) {
    const get = (tag: string) => {
      const m = block.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?<\\/${tag}>`, 's'))
      return m?.[1]?.replace(/<br\s*\/?>/gi, ' ').replace(/&[a-z]+;/gi, ' ').replace(/<[^>]+>/g, '').trim() ?? ''
    }
    items.push({
      title: get('title'),
      description: get('dataContents'),
      deadline: get('applicationEndDate'),
      startDate: get('applicationStartDate'),
      ministry: '중소벤처기업부',
      url: get('viewUrl'),
    })
  }
  return items.filter(i => i.title)
}

async function scoreWithClaude(items: RawItem[], apiKey: string): Promise<ScoredItem[]> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const anthropic = new Anthropic({ apiKey })

  // 배치 처리: 한 번의 API 호출로 여러 공고 동시 스코어링
  const list = items.map((item, i) =>
    `[${i}] 제목: ${item.title} | 내용: ${item.description?.slice(0, 200)} | 마감: ${item.deadline}`
  ).join('\n\n')

  const prompt = `다음 정부지원사업 공고들이 아래 회사에 얼마나 적합한지 각각 0-100점으로 평가하세요.

회사:${FITOGETHER_PROFILE}

공고 목록:
${list}

각 공고에 대해 JSON 배열로만 답변:
[{"index": 0, "score": 숫자, "reason": "이유 20자"}, {"index": 1, ...}, ...]
40점 미만은 제외해도 됩니다.`

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    })
    const text = (msg.content[0] as { text: string }).text
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    const results: Array<{ index: number; score: number; reason: string }> =
      JSON.parse(jsonMatch?.[0] ?? '[]')

    return results
      .filter(r => r.score >= 40)
      .map(r => ({
        title: items[r.index].title,
        ministry: items[r.index].ministry,
        deadline: items[r.index].deadline || null,
        scale: null,
        url: items[r.index].url,
        description: items[r.index].description?.slice(0, 600) ?? '',
        eligibility: '',
        match_score: r.score,
        match_reason: r.reason ?? '',
        source: items[r.index].ministry.includes('KOCCA') ? 'kocca' : 'mss',
        is_added: false,
      }))
  } catch {
    return []
  }
}

type RawItem = {
  title: string
  description: string
  deadline: string
  startDate: string
  ministry: string
  url: string
}

type KoccaItem = {
  title: string
  content?: string
  endDt?: string
  startDt?: string
  link?: string
}

type ScoredItem = {
  title: string; ministry: string; deadline: string | null; scale: string | null
  url: string; description: string; eligibility: string
  match_score: number; match_reason: string; source: string; is_added: boolean
}
