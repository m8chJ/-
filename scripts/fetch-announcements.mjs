/**
 * 정부 공고 수집 + AI 스코어링 스크립트
 * 실행: node scripts/fetch-announcements.mjs
 */

import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

const SUPABASE_URL = 'https://iayfqmmarwnacxruozle.supabase.co'
const SUPABASE_KEY = 'sb_publishable_1Mkh85ExNVQpf777hct_fw_IX0Mqw8l'
const MSS_KEY = '57619896c86c27a1f8d1e59f1a4a766c8ddaa271bbbfeba94954468a152ce926'
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY })

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

const fmt = (d) => d.toISOString().slice(0, 10)
const today = new Date()
const startDate = new Date(today)
startDate.setDate(today.getDate() - 60)

function parseXml(xml) {
  const items = []
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/g) ?? []
  for (const block of blocks) {
    const get = (tag) => {
      const m = block.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?<\\/${tag}>`, 's'))
      return m?.[1]?.replace(/<br\s*\/?>/gi, ' ').replace(/&[a-z#\d]+;/gi, ' ').replace(/<[^>]+>/g, '').trim() ?? ''
    }
    const title = get('title')
    if (title) items.push({
      title,
      description: get('dataContents'),
      deadline: get('applicationEndDate'),
      url: get('viewUrl'),
      ministry: '중소벤처기업부',
    })
  }
  return items
}

async function fetchMSS() {
  console.log('📥 중소벤처기업부 공고 수집 중...')
  const url = new URL('https://apis.data.go.kr/1421000/mssBizService_v2/getbizList_v2')
  url.searchParams.set('serviceKey', MSS_KEY)
  url.searchParams.set('pageNo', '1')
  url.searchParams.set('numOfRows', '50')
  // 날짜 필터 없이 전체 수집 후 마감일 기준으로 로컬 필터링

  const res = await fetch(url.toString())
  const xml = await res.text()
  const items = parseXml(xml)

  const todayStr = fmt(today)
  const valid = items.filter(i => !i.deadline || i.deadline >= todayStr)
  console.log(`  → ${valid.length}개 (마감 미경과 공고)`)
  return valid
}

async function fetchKSPO() {
  console.log('📥 국민체육진흥공단(스포츠산업) 공고 수집 중...')
  const url = new URL('https://apis.data.go.kr/B551014/SRVC_OD_API_SUPP_BUSI_INFO/todz_api_supp_busi_info_i')
  url.searchParams.set('serviceKey', MSS_KEY)
  url.searchParams.set('pageNo', '1')
  url.searchParams.set('numOfRows', '30')
  url.searchParams.set('resultType', 'json')

  const res = await fetch(url.toString())
  const json = await res.json()
  const raw = json?.response?.body?.items?.item ?? []

  const todayStr = fmt(today).replace(/-/g, '')
  const valid = raw
    .filter(i => !i.end_de || i.end_de >= todayStr)
    .map(i => ({
      title: i.title_nm ?? '',
      description: i.biz_cn ?? i.supp_cn ?? '',
      deadline: i.end_de ? `${i.end_de.slice(0,4)}-${i.end_de.slice(4,6)}-${i.end_de.slice(6,8)}` : null,
      url: i.detail_url ?? i.url ?? '',
      ministry: '국민체육진흥공단',
    }))
    .filter(i => i.title)

  console.log(`  → ${valid.length}개 (스포츠산업 공고)`)
  return valid
}

async function fetchMSIT() {
  console.log('📥 과학기술정보통신부 공고 수집 중...')
  const url = new URL('https://apis.data.go.kr/1721000/msitannouncementinfo/businessAnnouncMentList')
  url.searchParams.set('serviceKey', MSS_KEY)
  url.searchParams.set('pageNo', '1')
  url.searchParams.set('numOfRows', '30')

  const res = await fetch(url.toString())
  const xml = await res.text()
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/g) ?? []

  const items = blocks.map(block => {
    const get = tag => {
      const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`))
      return m?.[1]?.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').trim() ?? ''
    }
    return {
      title: get('subject'),
      description: get('deptName') ? `담당부서: ${get('deptName')}` : '',
      deadline: null,
      url: get('viewUrl'),
      ministry: '과학기술정보통신부',
    }
  }).filter(i => i.title)

  console.log(`  → ${items.length}개`)
  return items
}

async function fetchKISED() {
  console.log('📥 창업진흥원(K-Startup) 공고 수집 중...')
  const url = new URL('https://apis.data.go.kr/B552735/kisedKstartupService01/getAnnouncementInformation01')
  url.searchParams.set('serviceKey', MSS_KEY)
  url.searchParams.set('pageNo', '1')
  url.searchParams.set('numOfRows', '30')

  const res = await fetch(url.toString())
  const xml = await res.text()
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/g) ?? []

  const getCol = (block, name) => {
    const m = block.match(new RegExp(`<col name="${name}">(.*?)</col>`))
    return m?.[1]?.replace(/&#34;/g, '"').replace(/&amp;/g, '&').trim() ?? ''
  }

  const todayStr = fmt(today).replace(/-/g, '')
  const items = blocks
    .map(block => {
      const endDe = getCol(block, 'rcpt_end_de') || getCol(block, 'pbanc_end_de') || ''
      return {
        title: getCol(block, 'biz_pbanc_nm'),
        description: getCol(block, 'pbanc_ctnt'),
        deadline: endDe ? `${endDe.slice(0,4)}-${endDe.slice(4,6)}-${endDe.slice(6,8)}` : null,
        url: getCol(block, 'pbanc_url') || 'https://www.k-startup.go.kr',
        ministry: '창업진흥원',
      }
    })
    .filter(i => i.title && (!getCol(blocks[0] ?? '', 'rcpt_end_de') || !todayStr || true))

  console.log(`  → ${items.length}개`)
  return items
}

async function fetchNIPA() {
  console.log('📥 정보통신산업진흥원(NIPA) 공고 수집 중...')
  const url = new URL('https://apis.data.go.kr/B552551/supportBusinessList/getSupportBusinessList')
  url.searchParams.set('serviceKey', MSS_KEY)
  url.searchParams.set('pageNo', '1')
  url.searchParams.set('numOfRows', '30')
  url.searchParams.set('searchType', '1')
  url.searchParams.set('startDate', fmt(startDate))

  const res = await fetch(url.toString())
  const json = await res.json()
  const raw = json?.response?.body?.items ?? []

  const items = raw.map(i => ({
    title: i.title ?? '',
    description: i.summary ?? i.content ?? '',
    deadline: i.endDate ?? i.closingDate ?? null,
    url: i.detailLink ?? '',
    ministry: '정보통신산업진흥원',
  })).filter(i => i.title)

  console.log(`  → ${items.length}개`)
  return items
}

async function scoreWithClaude(items) {
  console.log(`🤖 Claude AI 분석 중... (${items.length}개)`)

  const list = items.map((item, i) =>
    `[${i}] 제목: ${item.title} | 내용: ${item.description?.slice(0, 300)} | 마감: ${item.deadline}`
  ).join('\n\n')

  const prompt = `당신은 정부지원사업 전문 컨설턴트입니다. 아래 회사가 각 공고에 실제로 지원 가능한지 엄격하게 판단하세요.

회사:${FITOGETHER_PROFILE}

[자격 판단 기준 - 아래 해당 시 즉시 0점]
- 업력 조건 미충족 (예: 명문장수기업 = 30년 이상 필요, 창업 3년 이내 전용 등)
- 제조업 전용인데 SW/IT 기업 제외 명시
- 개인사업자/소상공인/자영업 전용
- 특정 지역 제한(수도권 제외 등)이 있고 서울 소재 기업 해당 안 됨
- 지원금 수혜 중복 불가 조건으로 이미 받은 사업과 겹침이 명확한 경우

[높은 점수 기준 - 실제 지원 가능하고 적합한 경우]
- 중소기업/벤처기업/이노비즈 우대 또는 해당
- R&D, AI, IoT, 웨어러블, 스포츠기술, 해외진출, 수출 관련
- 기업부설연구소 보유 기업 우대
- 코스닥 상장 준비 기업 지원 사업

공고 목록:
${list}

각 공고에 대해 JSON 배열로만 답변. 지원 자격 미충족이 명확하면 반드시 0점:
[{"index": 0, "score": 숫자, "reason": "30자 이내 핵심 이유", "eligible": true or false}, ...]

60점 미만은 제외해도 됩니다.`

  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }]
  })

  const text = msg.content[0].text
  const jsonMatch = text.match(/\[[\s\S]*\]/)
  const results = JSON.parse(jsonMatch?.[0] ?? '[]')

  return results
    .filter(r => r.score >= 60 && r.eligible !== false)
    .map(r => ({
      title: items[r.index]?.title ?? '',
      ministry: items[r.index]?.ministry ?? '',
      deadline: items[r.index]?.deadline || null,
      scale: null,
      url: items[r.index]?.url ?? '',
      description: items[r.index]?.description?.slice(0, 600) ?? '',
      eligibility: r.eligible ? '지원 가능' : '자격 미충족',
      match_score: r.score,
      match_reason: r.reason ?? '',
      source: 'mss',
      is_added: false,
    }))
    .filter(i => i.title)
}

async function saveToSupabase(scored) {
  if (scored.length === 0) return 0

  // 오늘 이미 저장된 제목 제외
  const today = fmt(new Date())
  const { data: existing } = await supabase
    .from('recommendations')
    .select('title')
    .gte('fetched_at', today)
    .neq('source', 'demo')

  const existingTitles = new Set((existing ?? []).map(e => e.title))
  const newItems = scored.filter(s => !existingTitles.has(s.title))

  if (newItems.length > 0) {
    const { error } = await supabase.from('recommendations').insert(newItems)
    if (error) throw error
  }
  return newItems.length
}

async function main() {
  console.log('🚀 핏투게더 맞춤 공고 수집 시작\n')

  try {
    // 공고 수집 (여러 소스 병렬)
    const [mssItems, kspoItems, msitItems, kisedItems, nipaItems] = await Promise.all([fetchMSS(), fetchKSPO(), fetchMSIT(), fetchKISED(), fetchNIPA()])
    const allItems = [...mssItems, ...kspoItems, ...msitItems, ...kisedItems, ...nipaItems]

    if (allItems.length === 0) {
      console.log('⚠️  수집된 공고 없음')
      return
    }
    console.log(`\n📋 총 ${allItems.length}개 공고 수집 완료`)

    // AI 스코어링 (최대 40개)
    const scored = await scoreWithClaude(allItems.slice(0, 40))
    console.log(`  → ${scored.length}개 매칭 (40점 이상)`)

    // 점수 높은 순 출력
    scored.sort((a, b) => b.match_score - a.match_score)
    console.log('\n📊 매칭 결과:')
    for (const item of scored) {
      console.log(`  ${item.match_score}점 | ${item.title.slice(0, 50)} | 마감: ${item.deadline}`)
      console.log(`       → ${item.match_reason}`)
    }

    // Supabase 저장
    const saved = await saveToSupabase(scored)
    console.log(`\n✅ ${saved}개 신규 공고 저장 완료 (govmanager.vercel.app에서 확인)`)

  } catch (err) {
    console.error('❌ 오류:', err.message)
  }
}

main()
