import { NextResponse } from 'next/server'

export async function GET() {
  const KEY = process.env.MSS_API_KEY
  if (!KEY) return NextResponse.json({ error: 'MSS_API_KEY 없음' })

  const today = new Date()
  const startDate = new Date(today)
  startDate.setDate(today.getDate() - 60)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)

  const url = new URL('https://apis.data.go.kr/1421000/mssBizService_v2/getbizList_v2')
  url.searchParams.set('serviceKey', KEY)
  url.searchParams.set('pageNo', '1')
  url.searchParams.set('numOfRows', '5')
  url.searchParams.set('startDate', fmt(startDate))
  url.searchParams.set('endDate', fmt(today))

  const res = await fetch(url.toString())
  const text = await res.text()

  const itemMatches = text.match(/<item>([\s\S]*?)<\/item>/g) ?? []
  const totalMatch = text.match(/<totalCount>(\d+)<\/totalCount>/)

  const sample = itemMatches.slice(0, 2).map(block => {
    const get = (tag: string) => {
      const m = block.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?<\\/${tag}>`, 's'))
      return m?.[1]?.slice(0, 100) ?? ''
    }
    return { title: get('title'), deadline: get('applicationEndDate') }
  })

  return NextResponse.json({
    status: res.status,
    totalCount: totalMatch?.[1],
    itemBlockCount: itemMatches.length,
    today: fmt(today),
    startDate: fmt(startDate),
    sample
  })
}
