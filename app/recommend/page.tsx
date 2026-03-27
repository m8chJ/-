'use client'

import { useEffect, useState } from 'react'

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
  const style =
    score >= 80
      ? { bg: '#ECFDF3', color: '#12B76A' }
      : score >= 60
      ? { bg: '#EFF6FF', color: '#2563EB' }
      : { bg: '#F5F5F5', color: '#9CA3AF' }
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 700,
        backgroundColor: style.bg,
        color: style.color,
        whiteSpace: 'nowrap',
      }}
    >
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
  if (diff < 0) return { label: '마감', color: '#9CA3AF' }
  if (diff === 0) return { label: 'D-Day', color: '#EF4444' }
  if (diff <= 7) return { label: `D-${diff}`, color: '#EF4444' }
  if (diff <= 14) return { label: `D-${diff}`, color: '#F97316' }
  return { label: `D-${diff}`, color: '#9CA3AF' }
}

function SourceBadge({ source }: { source: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    mss: { label: '중기부', color: '#2563EB', bg: '#EFF6FF' },
    kocca: { label: 'KOCCA', color: '#7C3AED', bg: '#F5F3FF' },
  }
  const s = map[source] ?? { label: source, color: '#6B7280', bg: '#F5F5F5' }
  return (
    <span style={{ fontSize: 10, fontWeight: 600, color: s.color, backgroundColor: s.bg, padding: '2px 6px', borderRadius: 4 }}>
      {s.label}
    </span>
  )
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
      setFetchResult(json.error ? `오류: ${json.error}` : json.message ?? '완료')
      if (!json.error) await loadRecommendations()
    } catch {
      setFetchResult('네트워크 오류가 발생했습니다.')
    }
    setFetching(false)
  }

  const filtered = items.filter(i => i.match_score >= minScore)
  const highMatch = items.filter(i => i.match_score >= 80).length
  const midMatch = items.filter(i => i.match_score >= 60 && i.match_score < 80).length
  const lastFetched = items.length > 0
    ? new Date(items[0].fetched_at).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
    : null

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* 페이지 헤더 */}
      <div className="page-header">
        <p style={{ fontSize: 12, color: '#adbac9', marginBottom: 4 }}>AI 기반 맞춤 공고 분석</p>
        <h1 className="page-title" style={{ fontSize: 22, fontWeight: 700, color: '#1e2c33', letterSpacing: '-0.5px' }}>
          공고 추천
        </h1>
      </div>

      <div className="page-body">
        {/* 히어로 배너 */}
        <div
          style={{
            borderRadius: 16,
            padding: '28px 32px',
            marginBottom: 20,
            background: 'linear-gradient(135deg, #1e2c33 0%, #2d4a5a 60%, #384e5d 100%)',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 4px 20px rgba(30, 44, 51, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16,
          }}
          className="hero-banner"
        >
          <div style={{ position: 'absolute', right: -20, top: -20, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
          <div>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 10 }}>
              핏투게더 맞춤형 · 중기부 + KOCCA 공고 AI 분석
            </p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 8 }}>
              <div>
                <span style={{ fontSize: 42, fontWeight: 800, color: '#ffffff', letterSpacing: '-1px' }}>{highMatch}</span>
                <span style={{ fontSize: 16, color: 'rgba(255,255,255,0.7)', marginLeft: 4 }}>건 적극 추천</span>
              </div>
              {midMatch > 0 && (
                <>
                  <div style={{ width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.2)' }} />
                  <div>
                    <span style={{ fontSize: 28, fontWeight: 700, color: 'rgba(255,255,255,0.8)', letterSpacing: '-0.5px' }}>{midMatch}</span>
                    <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginLeft: 4 }}>건 검토 권장</span>
                  </div>
                </>
              )}
            </div>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
              {lastFetched ? `마지막 업데이트: ${lastFetched}` : '아직 공고를 가져오지 않았습니다'}
            </p>
          </div>
          <button
            onClick={fetchNew}
            disabled={fetching}
            style={{
              padding: '12px 22px',
              borderRadius: 10,
              backgroundColor: fetching ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.15)',
              color: fetching ? 'rgba(255,255,255,0.4)' : '#ffffff',
              border: '1px solid rgba(255,255,255,0.2)',
              fontSize: 13,
              fontWeight: 600,
              cursor: fetching ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
              backdropFilter: 'blur(10px)',
              flexShrink: 0,
            }}
          >
            {fetching ? '분석 중...' : '새 공고 분석'}
          </button>
        </div>

        {fetchResult && (
          <div style={{
            backgroundColor: '#F0FDF4',
            border: '1px solid #BBF7D0',
            borderRadius: 10,
            padding: '12px 16px',
            marginBottom: 16,
            fontSize: 13,
            color: '#15803D',
          }}>
            {fetchResult}
          </div>
        )}

        {/* 점수 필터 + 통계 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {[
              { val: 80, label: '80점+ 적극 추천', color: '#12B76A', bg: '#ECFDF3' },
              { val: 60, label: '60점+ 검토 권장', color: '#2563EB', bg: '#EFF6FF' },
              { val: 40, label: '40점+ 전체 보기', color: '#6B7280', bg: '#F5F5F5' },
            ].map(s => (
              <button
                key={s.val}
                onClick={() => setMinScore(s.val)}
                style={{
                  padding: '7px 14px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: minScore === s.val ? 'none' : '1px solid #E8ECF0',
                  backgroundColor: minScore === s.val ? s.bg : '#ffffff',
                  color: minScore === s.val ? s.color : '#adbac9',
                  transition: 'all 0.15s',
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
          <span style={{ fontSize: 12, color: '#adbac9' }}>총 {filtered.length}건</span>
        </div>

        {/* 공고 리스트 */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#adbac9', fontSize: 14 }}>
            불러오는 중...
          </div>
        ) : filtered.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '80px 0',
              backgroundColor: '#ffffff',
              borderRadius: 16,
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
            <p style={{ color: '#adbac9', fontSize: 14, marginBottom: 20 }}>
              {items.length === 0 ? '아직 가져온 공고가 없습니다.' : `${minScore}점 이상 공고가 없습니다.`}
            </p>
            {items.length === 0 && (
              <button
                onClick={fetchNew}
                disabled={fetching}
                style={{
                  padding: '12px 24px',
                  borderRadius: 10,
                  backgroundColor: '#1e2c33',
                  color: '#ffffff',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: 'none',
                }}
              >
                공고 분석 시작
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(item => {
              const dday = getDday(item.deadline)
              const isExpanded = expandedId === item.id
              const isAdded = addedIds.has(item.id) || item.is_added
              return (
                <div
                  key={item.id}
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: 14,
                    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                    overflow: 'hidden',
                    border: '1px solid #F0F3F6',
                    transition: 'box-shadow 0.15s',
                  }}
                >
                  <div
                    style={{ padding: '16px 20px', cursor: 'pointer' }}
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <ScoreBadge score={item.match_score} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                          <SourceBadge source={item.source} />
                          <span style={{ fontSize: 12, color: '#adbac9' }}>{item.ministry ?? '-'}</span>
                          {dday && (
                            <span style={{ fontSize: 12, fontWeight: 700, color: dday.color }}>{dday.label}</span>
                          )}
                          {item.deadline && (
                            <span style={{ fontSize: 11, color: '#ced7df' }}>{item.deadline}</span>
                          )}
                        </div>
                        <p style={{ fontSize: 14, fontWeight: 600, color: '#1e2c33', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.title}
                        </p>
                        {item.match_reason && (
                          <p style={{ fontSize: 12, color: '#707d89', marginTop: 4 }}>{item.match_reason}</p>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        {isAdded ? (
                          <span style={{ fontSize: 12, color: '#12B76A', fontWeight: 600 }}>✓ 추가됨</span>
                        ) : (
                          <button
                            onClick={async e => {
                              e.stopPropagation()
                              setAddedIds(prev => new Set([...prev, item.id]))
                              alert('공고 추가 기능은 곧 구현됩니다.\n현재는 공고 관리 페이지에서 직접 추가해주세요.')
                            }}
                            style={{
                              fontSize: 12,
                              padding: '6px 12px',
                              borderRadius: 7,
                              backgroundColor: '#1e2c33',
                              color: '#ffffff',
                              border: 'none',
                              cursor: 'pointer',
                              fontWeight: 600,
                            }}
                          >
                            + 추가
                          </button>
                        )}
                        {item.url && item.url.startsWith('http') && (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            style={{
                              fontSize: 12,
                              padding: '6px 12px',
                              borderRadius: 7,
                              border: '1px solid #E8ECF0',
                              color: '#707d89',
                              textDecoration: 'none',
                              fontWeight: 500,
                            }}
                          >
                            원문 보기 ↗
                          </a>
                        )}
                        <span style={{ color: '#ced7df', fontSize: 12 }}>{isExpanded ? '▲' : '▼'}</span>
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div style={{ padding: '16px 20px', borderTop: '1px solid #F5F7FA', backgroundColor: '#FAFBFC' }}>
                      {item.description && (
                        <div style={{ marginBottom: 12 }}>
                          <p style={{ fontSize: 11, color: '#adbac9', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>지원 내용</p>
                          <p style={{ fontSize: 13, color: '#384e5d', lineHeight: 1.7 }}>{item.description}</p>
                        </div>
                      )}
                      {item.eligibility && item.eligibility !== '지원 가능' && (
                        <div>
                          <p style={{ fontSize: 11, color: '#adbac9', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>신청 자격</p>
                          <p style={{ fontSize: 13, color: '#384e5d', lineHeight: 1.7 }}>{item.eligibility}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
