'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Recommendation = {
  id: string
  title: string
  ministry: string | null
  deadline: string | null
  scale: string | null
  url: string | null
  description: string | null
  eligibility: string | null
  match_score: number
  match_reason: string | null
  source: string
  is_added: boolean
  fetched_at: string
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80 ? 'bg-green-100 text-green-800' :
    score >= 60 ? 'bg-blue-100 text-blue-800' :
    score >= 40 ? 'bg-yellow-100 text-yellow-800' :
    'bg-gray-100 text-gray-500'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>
      {score}점
    </span>
  )
}

function getDday(dateStr: string | null) {
  if (!dateStr) return null
  const end = new Date(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  end.setHours(0, 0, 0, 0)
  const diff = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (diff < 0) return { label: '마감', color: 'text-gray-400' }
  if (diff === 0) return { label: 'D-Day', color: 'text-red-600 font-bold' }
  if (diff <= 7) return { label: `D-${diff}`, color: 'text-red-500 font-semibold' }
  if (diff <= 14) return { label: `D-${diff}`, color: 'text-orange-500' }
  return { label: `D-${diff}`, color: 'text-gray-400' }
}

export default function RecommendPage() {
  const [items, setItems] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)
  const [fetchResult, setFetchResult] = useState<string | null>(null)
  const [minScore, setMinScore] = useState(60)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())

  useEffect(() => { loadRecommendations() }, [])

  async function loadRecommendations() {
    setLoading(true)
    const res = await fetch('/api/recommendations')
    const json = await res.json()
    setItems(json.data ?? [])
    setLoading(false)
  }

  async function fetchNew() {
    setFetching(true)
    setFetchResult(null)
    try {
      const res = await fetch('/api/recommendations', { method: 'POST' })
      const json = await res.json()
      if (json.error) {
        setFetchResult(`오류: ${json.error}`)
      } else {
        setFetchResult(json.message ?? '완료')
        await loadRecommendations()
      }
    } catch {
      setFetchResult('네트워크 오류가 발생했습니다.')
    }
    setFetching(false)
  }

  const filtered = items.filter(i => i.match_score >= minScore)
  const lastFetched = items.length > 0 ? new Date(items[0].fetched_at).toLocaleDateString('ko-KR') : null

  return (
    <div className="min-h-screen bg-gray-50">
      <header style={{ backgroundColor: '#1e2c33' }}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">공고 추천</h1>
            <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.7)' }}>
              핏투게더 맞춤 정부지원사업 공고 AI 매칭
            </p>
          </div>
          <Link
            href="/"
            className="text-sm px-4 py-2 rounded-lg border border-white/20 text-white/80 hover:bg-white/10 transition-colors"
          >
            ← 공고 관리
          </Link>
        </div>
      </header>

      {/* 컨트롤 바 */}
      <div style={{ backgroundColor: '#384e5d' }}>
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-4 flex-wrap">
          <button
            onClick={fetchNew}
            disabled={fetching}
            style={{ backgroundColor: fetching ? '#707d89' : '#ecf0f4', color: '#1e2c33' }}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:cursor-not-allowed"
          >
            {fetching ? '분석 중...' : '새 공고 가져오기'}
          </button>
          {fetchResult && (
            <span className="text-white/80 text-sm">{fetchResult}</span>
          )}
          {lastFetched && !fetchResult && (
            <span className="text-white/50 text-xs">마지막 업데이트: {lastFetched}</span>
          )}
          <div className="ml-auto flex items-center gap-2">
            <span className="text-white/60 text-sm">최소 점수</span>
            {[30, 40, 60, 80].map(s => (
              <button
                key={s}
                onClick={() => setMinScore(s)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  minScore === s ? 'bg-white text-[#1e2c33]' : 'border border-white/30 text-white/70 hover:bg-white/10'
                }`}
              >
                {s}+
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 py-6">
        {/* 요약 */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-green-50 rounded-xl p-4">
            <p className="text-2xl font-bold text-green-700">{items.filter(i => i.match_score >= 80).length}</p>
            <p className="text-sm text-green-600 mt-1">적극 추천 (80점+)</p>
          </div>
          <div className="bg-blue-50 rounded-xl p-4">
            <p className="text-2xl font-bold text-blue-700">{items.filter(i => i.match_score >= 60 && i.match_score < 80).length}</p>
            <p className="text-sm text-blue-600 mt-1">검토 권장 (60-79점)</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
            <p className="text-2xl font-bold text-gray-700">{items.filter(i => i.match_score < 60).length}</p>
            <p className="text-sm text-gray-500 mt-1">참고용 (60점 미만)</p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400">불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-400 mb-4">
              {items.length === 0 ? '아직 가져온 공고가 없습니다.' : `${minScore}점 이상 공고가 없습니다.`}
            </p>
            {items.length === 0 && (
              <button
                onClick={fetchNew}
                disabled={fetching}
                style={{ backgroundColor: '#1e2c33' }}
                className="px-6 py-2 rounded-lg text-white text-sm font-medium"
              >
                공고 가져오기
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(item => {
              const dday = getDday(item.deadline)
              const isExpanded = expandedId === item.id
              const isAdded = addedIds.has(item.id) || item.is_added
              return (
                <div
                  key={item.id}
                  className="bg-white rounded-xl border border-gray-200 hover:border-gray-300 transition-colors"
                >
                  <div
                    className="p-4 cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  >
                    <div className="flex items-start gap-3">
                      <ScoreBadge score={item.match_score} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-gray-400">{item.ministry ?? '-'}</span>
                          {dday && (
                            <span className={`text-xs font-medium ${dday.color}`}>{dday.label}</span>
                          )}
                          {item.deadline && (
                            <span className="text-xs text-gray-300">{item.deadline}</span>
                          )}
                          {item.scale && (
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{item.scale}</span>
                          )}
                        </div>
                        <p className="font-medium text-gray-900 truncate">{item.title}</p>
                        {item.match_reason && (
                          <p className="text-xs text-gray-500 mt-1">{item.match_reason}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {isAdded ? (
                          <span className="text-xs text-green-600 font-medium">✓ 추가됨</span>
                        ) : (
                          <button
                            onClick={async (e) => {
                              e.stopPropagation()
                              // 공고 관리 페이지에 추가하는 기능 (추후 구현)
                              setAddedIds(prev => new Set([...prev, item.id]))
                              alert('공고 추가 기능은 곧 구현됩니다.\n현재는 공고 관리 페이지에서 직접 추가해주세요.')
                            }}
                            style={{ backgroundColor: '#1e2c33' }}
                            className="text-xs px-3 py-1.5 rounded-lg text-white hover:opacity-90"
                          >
                            + 공고 추가
                          </button>
                        )}
                        {item.url && item.url.startsWith('http') && (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-500 hover:text-[#1e2c33] hover:border-gray-400 transition-colors"
                          >
                            원문 보기 🔗
                          </a>
                        )}
                        <span className="text-gray-300 text-sm">{isExpanded ? '▲' : '▼'}</span>
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-gray-100 pt-4 space-y-3">
                      {item.description && (
                        <div>
                          <p className="text-xs text-gray-400 mb-1 font-medium">지원 내용</p>
                          <p className="text-sm text-gray-700 leading-relaxed">{item.description}</p>
                        </div>
                      )}
                      {item.eligibility && (
                        <div>
                          <p className="text-xs text-gray-400 mb-1 font-medium">신청 자격</p>
                          <p className="text-sm text-gray-700 leading-relaxed">{item.eligibility}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
