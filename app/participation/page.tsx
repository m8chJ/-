'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { Project } from '@/types/project'
import { RESEARCHERS, ResearcherProfile } from '../data/researchers'

type ParticipationEntry = {
  id: string
  project_id: string
  employee_name: string
  role: string | null
  rate: number
  annual_salary: number | null
  pay_type: string | null   // '현금' | '현물'
  employee_type: string | null  // '기존' | '신규'
  period_months: number | null
  period_start: string | null
  period_end: string | null
  created_at: string
}

type FormState = {
  employee_name: string
  role: string
  rate: string
  annual_salary: string
  pay_type: string
  employee_type: string
  period_months: string
  period_start: string
  period_end: string
}

const ROLES = ['연구책임자', '참여연구원', '위탁연구원', '보조연구원', '행정지원']
const ACTIVE_STATUSES = ['최종 선정', '최종선정', '서류 통과', '서류통과', '제출 완료', '제출완료']
const EXCLUDED_STATUSES = ['미선정', '지원취소']

function calcLaborCost(annualSalary: number, rate: number, months: number): number {
  if (!annualSalary || !rate || !months) return 0
  return Math.round((annualSalary / 12) * (rate / 100) * months)
}

function formatKRW(amount: number): string {
  if (amount === 0) return '-'
  return new Intl.NumberFormat('ko-KR').format(amount) + '원'
}

function formatMillions(amount: number): string {
  if (amount === 0) return '0원'
  if (amount >= 100000000) return `${(amount / 100000000).toFixed(1)}억원`
  if (amount >= 10000) return `${Math.round(amount / 10000).toLocaleString()}만원`
  return new Intl.NumberFormat('ko-KR').format(amount) + '원'
}

export default function ParticipationPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [entries, setEntries] = useState<ParticipationEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'employee' | 'project'>('employee')
  const [dbError, setDbError] = useState<string | null>(null)
  const [selectedResearcher, setSelectedResearcher] = useState<ResearcherProfile | null>(null)
  const [showPiChange, setShowPiChange] = useState(false)
  const [form, setForm] = useState<FormState>({
    employee_name: '',
    role: '참여연구원',
    rate: '',
    annual_salary: '',
    pay_type: '현금',
    employee_type: '기존',
    period_months: '',
    period_start: '',
    period_end: '',
  })

  useEffect(() => {
    Promise.all([
      supabase.from('projects').select('*').order('project_name'),
      supabase.from('participation_rates').select('*').order('employee_name'),
    ]).then(([p, r]) => {
      const list = p.data ?? []
      setProjects(list)
      const activeList = list.filter(pr => !EXCLUDED_STATUSES.includes(pr.status ?? ''))
      if (activeList.length > 0) setSelectedProjectId(activeList[0].id)
      setEntries((r.data ?? []) as ParticipationEntry[])
      setLoading(false)
    })
  }, [])

  // 프로젝트 상태 맵
  const allProjects = useMemo(() => {
    const map: Record<string, Project> = {}
    projects.forEach(p => { map[p.id] = p })
    return map
  }, [projects])

  // 수행중 상태 (최종 선정)
  const PERFORMING_STATUSES = ['최종 선정', '최종선정']

  // 주관/단독 = 3책 대상, 공동/위탁 = 3책 비대상
  const PI_3CHAEK_TYPES = ['주관', '단독']

  // 인력별 집계
  const employeeSummary = useMemo(() => {
    const map: Record<string, {
      total: number
      totalLaborCost: number
      cashLaborCost: number
      inkindLaborCost: number
      piLeadActiveCount: number   // 주관 수행중 연구책임자 (3책 대상)
      piLeadAppliedCount: number  // 주관 신청중 연구책임자 (3책 대상)
      piSubCount: number          // 공동/위탁 연구책임자 (3책 비대상, 5공만)
      projectCount: number        // 참여 과제 수 (5공 체크)
      projects: {
        id: string
        name: string
        rate: number
        role: string | null
        laborCost: number
        pay_type: string | null
        months: number | null
        projectStatus: string | null
        implType: string | null
      }[]
    }> = {}

    entries.forEach(e => {
      const project = allProjects[e.project_id]
      // 미선정/지원취소 과제는 참여율 집계에서 제외
      if (project && EXCLUDED_STATUSES.includes(project.status ?? '')) return
      const laborCost = calcLaborCost(e.annual_salary ?? 0, e.rate, e.period_months ?? 0)
      if (!map[e.employee_name]) {
        map[e.employee_name] = { total: 0, totalLaborCost: 0, cashLaborCost: 0, inkindLaborCost: 0, piLeadActiveCount: 0, piLeadAppliedCount: 0, piSubCount: 0, projectCount: 0, projects: [] }
      }
      map[e.employee_name].total += e.rate
      map[e.employee_name].totalLaborCost += laborCost
      map[e.employee_name].projectCount += 1
      if (e.pay_type === '현물') {
        map[e.employee_name].inkindLaborCost += laborCost
      } else {
        map[e.employee_name].cashLaborCost += laborCost
      }
      // 3책5공 계산
      if (e.role === '연구책임자') {
        const implType = project?.implementation_type ?? ''
        const pStatus = project?.status ?? ''
        if (PI_3CHAEK_TYPES.includes(implType)) {
          // 주관/단독 → 3책 대상
          if (PERFORMING_STATUSES.includes(pStatus)) {
            map[e.employee_name].piLeadActiveCount += 1
          } else {
            map[e.employee_name].piLeadAppliedCount += 1
          }
        } else {
          // 공동/위탁 → 3책 비대상
          map[e.employee_name].piSubCount += 1
        }
      }
      map[e.employee_name].projects.push({
        id: e.project_id,
        name: project?.project_name ?? '(삭제된 과제)',
        rate: e.rate,
        role: e.role,
        laborCost,
        pay_type: e.pay_type,
        months: e.period_months,
        projectStatus: project?.status ?? null,
        implType: project?.implementation_type ?? null,
      })
    })

    return Object.entries(map)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.total - a.total)
  }, [entries, allProjects, PERFORMING_STATUSES])

  const projectEntries = entries.filter(e => e.project_id === selectedProjectId)
  const projectTotalRate = projectEntries.reduce((s, e) => s + e.rate, 0)
  const projectTotalCash = projectEntries
    .filter(e => e.pay_type !== '현물')
    .reduce((s, e) => s + calcLaborCost(e.annual_salary ?? 0, e.rate, e.period_months ?? 0), 0)
  const projectTotalInkind = projectEntries
    .filter(e => e.pay_type === '현물')
    .reduce((s, e) => s + calcLaborCost(e.annual_salary ?? 0, e.rate, e.period_months ?? 0), 0)

  const previewLaborCost = calcLaborCost(
    Number(form.annual_salary) || 0,
    Number(form.rate) || 0,
    Number(form.period_months) || 0,
  )

  async function saveEntry() {
    if (!selectedProjectId || !form.employee_name || !form.rate) return
    const data = {
      project_id: selectedProjectId,
      employee_name: form.employee_name,
      role: form.role || null,
      rate: Number(form.rate),
      annual_salary: Number(form.annual_salary) || null,
      pay_type: form.pay_type || '현금',
      employee_type: form.employee_type || '기존',
      period_months: Number(form.period_months) || null,
      period_start: form.period_start || null,
      period_end: form.period_end || null,
    }
    setDbError(null)
    if (editingId) {
      const { error } = await supabase.from('participation_rates').update(data).eq('id', editingId)
      if (error) {
        setDbError('저장 실패: DB 컬럼이 누락되었습니다. 아래 SQL을 Supabase에서 실행해주세요.')
        return
      }
      setEntries(prev => prev.map(e => e.id === editingId ? { ...e, ...data } : e))
    } else {
      const { data: inserted, error } = await supabase.from('participation_rates').insert(data).select().single()
      if (error) {
        setDbError('저장 실패: DB 컬럼이 누락되었습니다. 아래 SQL을 Supabase에서 실행해주세요.')
        return
      }
      if (inserted) setEntries(prev => [...prev, inserted as ParticipationEntry])
    }
    resetForm()
  }

  async function deleteEntry(id: string) {
    await supabase.from('participation_rates').delete().eq('id', id)
    setEntries(prev => prev.filter(e => e.id !== id))
  }

  function resetForm() {
    setShowForm(false)
    setEditingId(null)
    setForm({
      employee_name: '', role: '참여연구원', rate: '',
      annual_salary: '', pay_type: '현금', employee_type: '기존',
      period_months: '', period_start: '', period_end: '',
    })
  }

  function startEdit(e: ParticipationEntry) {
    setEditingId(e.id)
    setSelectedProjectId(e.project_id)
    setForm({
      employee_name: e.employee_name,
      role: e.role ?? '참여연구원',
      rate: String(e.rate),
      annual_salary: String(e.annual_salary ?? ''),
      pay_type: e.pay_type ?? '현금',
      employee_type: e.employee_type ?? '기존',
      period_months: String(e.period_months ?? ''),
      period_start: e.period_start ?? '',
      period_end: e.period_end ?? '',
    })
    setShowForm(true)
    setViewMode('project')
  }

  // 현재 선택된 과제의 연구책임자
  const currentPi = projectEntries.find(e => e.role === '연구책임자')

  async function changePi(newPiName: string) {
    if (!selectedProjectId) return
    // 기�� 연구책임자 → 참여연구원
    const oldPiEntries = projectEntries.filter(e => e.role === '연구책임자')
    for (const old of oldPiEntries) {
      await supabase.from('participation_rates').update({ role: '참여연구원' }).eq('id', old.id)
    }
    // 새 연구책임자 설정
    const newPiEntry = projectEntries.find(e => e.employee_name === newPiName)
    if (newPiEntry) {
      await supabase.from('participation_rates').update({ role: '연구책임자' }).eq('id', newPiEntry.id)
    }
    // projects 테이블의 manager도 업데이트
    await supabase.from('projects').update({ manager: newPiName }).eq('id', selectedProjectId)
    // 로컬 상태 반영
    setEntries(prev => prev.map(e => {
      if (e.project_id !== selectedProjectId) return e
      if (e.role === '연구책임자') return { ...e, role: '참여연구원' }
      if (e.employee_name === newPiName) return { ...e, role: '연구책임자' }
      return e
    }))
    setProjects(prev => prev.map(p =>
      p.id === selectedProjectId ? { ...p, manager: newPiName } : p
    ))
    setShowPiChange(false)
  }

  if (loading) return <div style={{ padding: 40, color: '#adbac9' }}>불러오는 중...</div>

  const totalOverCount = employeeSummary.filter(e => e.total > 100).length
  const grandTotalLaborCost = employeeSummary.reduce((s, e) => s + e.totalLaborCost, 0)
  const pi3Violations = employeeSummary.filter(e => (e.piLeadActiveCount + e.piLeadAppliedCount) > 3)
  const proj5Violations = employeeSummary.filter(e => e.projectCount > 5)

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Hero Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #1e2c33 0%, #2d4454 100%)',
        padding: '28px 32px 32px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -20, right: -20, width: 200, height: 200, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.03)' }} />
        <div style={{ position: 'absolute', bottom: -40, right: 80, width: 140, height: 140, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.04)' }} />
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 4, letterSpacing: '0.3px' }}>
          인력별 과제 참여율 관리 (합계 100% 이하)
        </p>
        <h1 className="page-title" style={{ fontSize: 24, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px', marginBottom: 20 }}>
          참여율 관리
        </h1>
        <div className="hero-stats">
          {[
            { label: '등록 인력', value: `${employeeSummary.length}명`, alert: false },
            { label: '참여율 초과', value: `${totalOverCount}명`, alert: totalOverCount > 0 },
            { label: '3책 위반', value: `${pi3Violations.length}명`, alert: pi3Violations.length > 0 },
            { label: '5공 위반', value: `${proj5Violations.length}명`, alert: proj5Violations.length > 0 },
            { label: '총 인건비', value: formatMillions(grandTotalLaborCost), alert: false },
          ].map(stat => (
            <div key={stat.label} className="hero-stat-card">
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>{stat.label}</p>
              <p style={{ fontSize: 22, fontWeight: 800, color: stat.alert ? '#FCA5A5' : '#fff' }}>{stat.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '20px 32px 32px' }}>
        {/* DB 오류 안내 */}
        {dbError && (
          <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#DC2626' }}>
            ⚠️ {dbError}
            <details style={{ marginTop: 8 }}>
              <summary style={{ cursor: 'pointer', fontSize: 12, color: '#9CA3AF' }}>마이그레이션 SQL 보기</summary>
              <pre style={{ fontSize: 11, marginTop: 8, backgroundColor: '#fff', padding: 10, borderRadius: 6, overflowX: 'auto', color: '#374151' }}>
{`ALTER TABLE participation_rates
ADD COLUMN IF NOT EXISTS annual_salary NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS pay_type TEXT DEFAULT '현금',
ADD COLUMN IF NOT EXISTS employee_type TEXT DEFAULT '기존',
ADD COLUMN IF NOT EXISTS period_months NUMERIC DEFAULT 0;`}
              </pre>
            </details>
          </div>
        )}

        {/* 뷰 토글 */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {[
            { key: 'employee', label: '인력별 현황' },
            { key: 'project', label: '과제별 입력' },
          ].map(v => (
            <button key={v.key} onClick={() => setViewMode(v.key as 'employee' | 'project')}
              style={{
                padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
                backgroundColor: viewMode === v.key ? '#1e2c33' : '#fff',
                color: viewMode === v.key ? '#fff' : '#707d89',
                border: viewMode === v.key ? 'none' : '1px solid #E8ECF0',
              }}>
              {v.label}
            </button>
          ))}
        </div>

        {viewMode === 'employee' ? (
          /* ── 인력별 현황 ── */
          <div>
            {employeeSummary.length === 0 ? (
              <div style={{ backgroundColor: '#fff', borderRadius: 16, padding: '60px 0', textAlign: 'center', color: '#adbac9', fontSize: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <p style={{ marginBottom: 16 }}>등록된 참여율 데이터가 없습니다</p>
                <button onClick={() => setViewMode('project')}
                  style={{ padding: '10px 20px', borderRadius: 10, backgroundColor: '#1e2c33', color: '#fff', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                  과제별 입력으로 이동
                </button>
              </div>
            ) : (
              <div style={{ backgroundColor: '#fff', borderRadius: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ backgroundColor: '#FAFBFC', borderBottom: '1px solid #F0F3F6' }}>
                      {['이름', '참여율 현황', '3책5공', '현금 인건비', '현물 인건비', '참여 과제'].map(h => (
                        <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#adbac9', fontSize: 11, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {employeeSummary.map(emp => {
                      const isOver = emp.total > 100
                      const isWarning = emp.total >= 80 && emp.total <= 100
                      return (
                        <tr key={emp.name} style={{ borderTop: '1px solid #F5F7FA' }}>
                          <td style={{ padding: '14px 16px' }}>
                            <div
                              style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: RESEARCHERS[emp.name] ? 'pointer' : 'default' }}
                              onClick={() => { const r = RESEARCHERS[emp.name]; if (r) setSelectedResearcher(r) }}
                            >
                              <div style={{
                                width: 32, height: 32, borderRadius: '50%',
                                backgroundColor: isOver ? '#FEF2F2' : '#F5F7FA',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 13, fontWeight: 700, color: isOver ? '#DC2626' : '#1e2c33', flexShrink: 0,
                              }}>
                                {emp.name[0]}
                              </div>
                              <div>
                                <span style={{ fontWeight: 700, color: '#1e2c33', fontSize: 14 }}>{emp.name}</span>
                                {RESEARCHERS[emp.name] && (
                                  <span style={{ fontSize: 11, color: '#adbac9', marginLeft: 6 }}>
                                    {RESEARCHERS[emp.name].position} · {RESEARCHERS[emp.name].researchField}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '14px 16px', minWidth: 180 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ flex: 1, height: 6, backgroundColor: '#F0F3F6', borderRadius: 3, overflow: 'hidden' }}>
                                <div style={{
                                  width: `${Math.min(emp.total, 100)}%`, height: '100%', borderRadius: 3,
                                  backgroundColor: isOver ? '#EF4444' : isWarning ? '#F97316' : '#1e2c33',
                                }} />
                              </div>
                              <span style={{
                                fontSize: 13, fontWeight: 700, minWidth: 44, textAlign: 'right',
                                color: isOver ? '#DC2626' : isWarning ? '#D97706' : '#1e2c33',
                              }}>
                                {emp.total}%
                              </span>
                              {isOver && (
                                <span style={{ fontSize: 10, fontWeight: 700, color: '#DC2626', backgroundColor: '#FEF2F2', padding: '2px 6px', borderRadius: 10, whiteSpace: 'nowrap' }}>
                                  초과
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            {(() => {
                              const piLeadTotal = emp.piLeadActiveCount + emp.piLeadAppliedCount
                              const is3Over = piLeadTotal > 3
                              const is5Over = emp.projectCount > 5
                              return (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: 11, fontWeight: 600, color: '#adbac9' }}>3책:</span>
                                    {emp.piLeadActiveCount > 0 && (
                                      <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 6px', borderRadius: 4, backgroundColor: '#DC262620', color: '#DC2626' }}>
                                        주관수행 {emp.piLeadActiveCount}
                                      </span>
                                    )}
                                    {emp.piLeadAppliedCount > 0 && (
                                      <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 6px', borderRadius: 4, backgroundColor: '#F9731620', color: '#EA580C' }}>
                                        주관신청 {emp.piLeadAppliedCount}
                                      </span>
                                    )}
                                    {emp.piSubCount > 0 && (
                                      <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 6px', borderRadius: 4, backgroundColor: '#3B82F620', color: '#2563EB' }}>
                                        공동/위탁 {emp.piSubCount}
                                      </span>
                                    )}
                                    {piLeadTotal === 0 && emp.piSubCount === 0 && <span style={{ fontSize: 11, color: '#D1D5DB' }}>-</span>}
                                    {is3Over && <span style={{ fontSize: 10, fontWeight: 700, color: '#DC2626', backgroundColor: '#FEF2F2', padding: '1px 5px', borderRadius: 10 }}>3책초과!</span>}
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ fontSize: 11, fontWeight: 600, color: '#adbac9' }}>5공:</span>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: is5Over ? '#DC2626' : '#1e2c33' }}>{emp.projectCount}건</span>
                                    {is5Over && <span style={{ fontSize: 10, fontWeight: 700, color: '#DC2626', backgroundColor: '#FEF2F2', padding: '1px 5px', borderRadius: 10 }}>5공초과!</span>}
                                  </div>
                                </div>
                              )
                            })()}
                          </td>
                          <td style={{ padding: '14px 16px', color: '#1e40af', fontWeight: 600, fontSize: 12 }}>
                            {emp.cashLaborCost > 0 ? formatKRW(emp.cashLaborCost) : '-'}
                          </td>
                          <td style={{ padding: '14px 16px', color: '#047857', fontWeight: 600, fontSize: 12 }}>
                            {emp.inkindLaborCost > 0 ? formatKRW(emp.inkindLaborCost) : '-'}
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              {emp.projects.map((p, i) => {
                                const isPi = p.role === '연구책임자'
                                const isLead = PI_3CHAEK_TYPES.includes(p.implType ?? '')
                                const isPerforming = isPi && PERFORMING_STATUSES.includes(p.projectStatus ?? '')
                                const isApplied = isPi && !isPerforming
                                return (
                                  <span key={i} style={{
                                    fontSize: 11, padding: '3px 8px', borderRadius: 6, whiteSpace: 'nowrap',
                                    backgroundColor: isPerforming && isLead ? '#DC262618' : isApplied && isLead ? '#F9731618' : isPi ? '#3B82F618' : '#F5F7FA',
                                    color: isPerforming && isLead ? '#DC2626' : isApplied && isLead ? '#EA580C' : isPi ? '#2563EB' : '#384e5d',
                                    border: isPi ? `1px solid ${isPerforming && isLead ? '#DC262640' : isApplied && isLead ? '#F9731640' : '#3B82F640'}` : 'none',
                                  }}>
                                    {isPi && isLead && <span style={{ marginRight: 3 }}>{isPerforming ? '🔴' : '🟠'}</span>}
                                    {isPi && !isLead && <span style={{ marginRight: 3 }}>🔵</span>}
                                    {p.implType && <span style={{ marginRight: 3, opacity: 0.7 }}>[{p.implType}]</span>}
                                    {p.name} <strong>{p.rate}%</strong>
                                    {p.pay_type && <span style={{ marginLeft: 3, opacity: 0.7 }}>({p.pay_type})</span>}
                                  </span>
                                )
                              })}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          /* ── 과제별 입력 ── */
          <div>
            {/* 과제 선택 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
              <select
                value={selectedProjectId ?? ''}
                onChange={e => { setSelectedProjectId(e.target.value); setShowForm(false); setShowPiChange(false) }}
                className="project-select"
              >
                {projects.filter(p => !EXCLUDED_STATUSES.includes(p.status ?? '')).map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
              </select>
              {selectedProjectId && projectEntries.length > 0 && (
                <>
                  <span style={{
                    fontSize: 13, fontWeight: 700,
                    color: projectTotalRate > 100 ? '#DC2626' : '#1e2c33',
                    backgroundColor: projectTotalRate > 100 ? '#FEF2F2' : '#F5F7FA',
                    padding: '6px 12px', borderRadius: 8,
                  }}>
                    {projectTotalRate > 100 ? '⚠️ ' : ''}참여율 합계 {projectTotalRate}%
                  </span>
                  {projectTotalCash > 0 && (
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#1e40af', backgroundColor: '#EFF6FF', padding: '6px 12px', borderRadius: 8 }}>
                      현금 {formatMillions(projectTotalCash)}
                    </span>
                  )}
                  {projectTotalInkind > 0 && (
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#047857', backgroundColor: '#F0FDF4', padding: '6px 12px', borderRadius: 8 }}>
                      현물 {formatMillions(projectTotalInkind)}
                    </span>
                  )}
                </>
              )}
            </div>

            {/* 연구책임자 변경 */}
            {selectedProjectId && projectEntries.length > 0 && (
              <div style={{
                backgroundColor: '#fff', borderRadius: 12, padding: '14px 20px', marginBottom: 12,
                border: '1px solid #F0F3F6', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
              }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#707d89' }}>연구책임자</span>
                {!showPiChange ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      fontSize: 13, fontWeight: 700, color: '#DC2626',
                      backgroundColor: '#DC262612', padding: '4px 12px', borderRadius: 6,
                      border: '1px solid #DC262630',
                    }}>
                      {currentPi ? currentPi.employee_name : '미지정'}
                    </span>
                    <button
                      onClick={() => setShowPiChange(true)}
                      style={{
                        fontSize: 11, padding: '4px 10px', borderRadius: 6,
                        backgroundColor: '#F5F7FA', color: '#384e5d', border: '1px solid #E8ECF0',
                        cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
                      }}
                    >
                      변경
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <select
                      defaultValue=""
                      onChange={e => { if (e.target.value) changePi(e.target.value) }}
                      style={{
                        fontSize: 13, padding: '5px 12px', borderRadius: 6,
                        border: '1px solid #E8ECF0', color: '#1e2c33', fontFamily: 'inherit',
                      }}
                    >
                      <option value="" disabled>인력 선택...</option>
                      {projectEntries
                        .filter(e => e.role !== '연구책임자')
                        .map(e => <option key={e.id} value={e.employee_name}>{e.employee_name} ({e.role ?? '참여연구원'})</option>)
                      }
                    </select>
                    <button
                      onClick={() => setShowPiChange(false)}
                      style={{
                        fontSize: 11, padding: '4px 10px', borderRadius: 6,
                        backgroundColor: '#fff', color: '#707d89', border: '1px solid #E8ECF0',
                        cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      ���소
                    </button>
                  </div>
                )}
                {(() => {
                  const proj = projects.find(p => p.id === selectedProjectId)
                  const statusLabel = proj?.status ?? ''
                  const implType = proj?.implementation_type ?? ''
                  const isPerforming = PERFORMING_STATUSES.includes(statusLabel)
                  const isLead = PI_3CHAEK_TYPES.includes(implType)
                  return (
                    <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
                      {implType && (
                        <span style={{
                          fontSize: 11, padding: '3px 8px', borderRadius: 4, fontWeight: 600,
                          backgroundColor: isLead ? '#FEF2F2' : '#EFF6FF',
                          color: isLead ? '#DC2626' : '#2563EB',
                        }}>
                          {implType}
                        </span>
                      )}
                      <span style={{
                        fontSize: 11, padding: '3px 8px', borderRadius: 4, fontWeight: 600,
                        backgroundColor: isPerforming ? '#ECFDF3' : '#FEF9C3',
                        color: isPerforming ? '#059669' : '#854D0E',
                      }}>
                        {isPerforming ? '수행중' : statusLabel}
                      </span>
                    </div>
                  )
                })()}
              </div>
            )}

            <div style={{ backgroundColor: '#fff', borderRadius: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
              {/* 헤더 */}
              <div style={{ padding: '18px 20px', borderBottom: '1px solid #F0F3F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1e2c33' }}>인력 참여율 · 인���비</h2>
                  <p style={{ fontSize: 12, color: '#adbac9', marginTop: 2 }}>인건비 = 연봉 ÷ 12 × 참여율(%) × 참여기간(월)</p>
                </div>
                <button
                  onClick={() => { resetForm(); setShowForm(true) }}
                  style={{ padding: '8px 16px', borderRadius: 8, backgroundColor: '#1e2c33', color: '#fff', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  + 인력 추가
                </button>
              </div>

              {/* 입력 폼 */}
              {showForm && (
                <div style={{ padding: '18px 20px', backgroundColor: '#F9FAFB', borderBottom: '1px solid #F0F3F6' }}>
                  <div className="form-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 10 }}>
                    <div>
                      <label style={labelStyle}>이름 *</label>
                      <input
                        value={form.employee_name}
                        onChange={e => setForm(p => ({ ...p, employee_name: e.target.value }))}
                        placeholder="홍길동"
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>역할</label>
                      <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))} style={inputStyle}>
                        {ROLES.map(r => <option key={r}>{r}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>구분</label>
                      <select value={form.employee_type} onChange={e => setForm(p => ({ ...p, employee_type: e.target.value }))} style={inputStyle}>
                        <option value="기존">기존</option>
                        <option value="신규">신규</option>
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>인건비 유형</label>
                      <select value={form.pay_type} onChange={e => setForm(p => ({ ...p, pay_type: e.target.value }))} style={inputStyle}>
                        <option value="현금">현금</option>
                        <option value="현물">현물</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 10 }}>
                    <div>
                      <label style={labelStyle}>연봉 (원)</label>
                      <input
                        type="number"
                        value={form.annual_salary}
                        onChange={e => setForm(p => ({ ...p, annual_salary: e.target.value }))}
                        placeholder="50000000"
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>참여율 (%) *</label>
                      <input
                        type="number"
                        value={form.rate}
                        onChange={e => setForm(p => ({ ...p, rate: e.target.value }))}
                        placeholder="30"
                        min={1} max={100}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>참여기간 (월)</label>
                      <input
                        type="number"
                        value={form.period_months}
                        onChange={e => setForm(p => ({ ...p, period_months: e.target.value }))}
                        placeholder="12"
                        min={1} max={60}
                        style={inputStyle}
                      />
                    </div>
                  </div>
                  <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                    <div>
                      <label style={labelStyle}>참여 시작일</label>
                      <input type="date" value={form.period_start} onChange={e => setForm(p => ({ ...p, period_start: e.target.value }))} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>참여 종료일</label>
                      <input type="date" value={form.period_end} onChange={e => setForm(p => ({ ...p, period_end: e.target.value }))} style={inputStyle} />
                    </div>
                  </div>
                  {/* 계산 미리보기 */}
                  {previewLaborCost > 0 && (
                    <div style={{ backgroundColor: '#EFF6FF', borderRadius: 8, padding: '10px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, color: '#3B82F6', fontWeight: 600 }}>예상 인건비:</span>
                      <span style={{ fontSize: 12, color: '#1e40af' }}>
                        {Number(form.annual_salary).toLocaleString()}원 ÷ 12 × {form.rate}% × {form.period_months}개월
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 800, color: '#1e40af', marginLeft: 'auto' }}>
                        = {formatKRW(previewLaborCost)}
                      </span>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={saveEntry} style={btnPrimary}>저장</button>
                    <button onClick={resetForm} style={btnSecondary}>취소</button>
                  </div>
                </div>
              )}

              {/* 테이블 */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ backgroundColor: '#FAFBFC', borderBottom: '1px solid #F0F3F6' }}>
                      {['이름', '역할', '구분', '연봉', '참여율', '기간', '현금 인건비', '현물 인건비', '인력 전체 참여율', ''].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#adbac9', fontSize: 11, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {projectEntries.length === 0 ? (
                      <tr>
                        <td colSpan={10} style={{ padding: '48px', textAlign: 'center', color: '#adbac9', fontSize: 13 }}>
                          등록된 인력이 없습니다. 인력 추가 버튼을 눌러 입력하세요.
                        </td>
                      </tr>
                    ) : projectEntries.map(entry => {
                      const laborCost = calcLaborCost(entry.annual_salary ?? 0, entry.rate, entry.period_months ?? 0)
                      const isCash = entry.pay_type !== '현물'
                      const empTotal = employeeSummary.find(e => e.name === entry.employee_name)?.total ?? entry.rate
                      const isOver = empTotal > 100
                      return (
                        <tr key={entry.id} style={{ borderTop: '1px solid #F5F7FA' }}>
                          <td style={{ padding: '12px 14px' }}>
                            <span
                              style={{ fontWeight: 700, color: '#1e2c33', cursor: RESEARCHERS[entry.employee_name] ? 'pointer' : 'default', borderBottom: RESEARCHERS[entry.employee_name] ? '1px dashed #adbac9' : 'none' }}
                              onClick={() => { const r = RESEARCHERS[entry.employee_name]; if (r) setSelectedResearcher(r) }}
                            >
                              {entry.employee_name}
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <button
                              onClick={async () => {
                                const newRole = entry.role === '연구책임자' ? '참여연구원' : '연구책임자'
                                await supabase.from('participation_rates').update({ role: newRole }).eq('id', entry.id)
                                setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, role: newRole } : e))
                              }}
                              style={{
                                fontSize: 11, padding: '3px 10px', borderRadius: 4, fontWeight: 700, cursor: 'pointer',
                                border: entry.role === '연구책임자' ? '1.5px solid #DC262660' : '1px solid #E8ECF0',
                                backgroundColor: entry.role === '연구책임자' ? '#DC262615' : '#F5F7FA',
                                color: entry.role === '연구책임자' ? '#DC2626' : '#384e5d',
                                fontFamily: 'inherit',
                              }}
                              title="클릭하여 연구책임자 ↔ 참여연구원 전환"
                            >
                              {entry.role === '연구책임자' ? '🔴 연구책임자' : entry.role ?? '참여연구원'}
                            </button>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <span style={{
                              fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 600,
                              backgroundColor: entry.employee_type === '신규' ? '#FEF9C3' : '#F5F7FA',
                              color: entry.employee_type === '신규' ? '#854D0E' : '#384e5d',
                            }}>
                              {entry.employee_type ?? '기존'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px', color: '#707d89', fontSize: 12 }}>
                            {entry.annual_salary ? `${Math.round(entry.annual_salary / 10000).toLocaleString()}만원` : '-'}
                          </td>
                          <td style={{ padding: '12px 14px', fontWeight: 700, color: '#1e2c33', fontSize: 15 }}>
                            {entry.rate}%
                          </td>
                          <td style={{ padding: '12px 14px', color: '#707d89', fontSize: 12 }}>
                            {entry.period_months ? `${entry.period_months}개월` : '-'}
                          </td>
                          <td style={{ padding: '12px 14px', fontWeight: 600, color: isCash && laborCost > 0 ? '#1e40af' : '#D1D5DB' }}>
                            {isCash && laborCost > 0 ? formatKRW(laborCost) : '-'}
                          </td>
                          <td style={{ padding: '12px 14px', fontWeight: 600, color: !isCash && laborCost > 0 ? '#047857' : '#D1D5DB' }}>
                            {!isCash && laborCost > 0 ? formatKRW(laborCost) : '-'}
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <span style={{
                              fontSize: 12, fontWeight: 700,
                              color: isOver ? '#DC2626' : '#12B76A',
                              backgroundColor: isOver ? '#FEF2F2' : '#ECFDF3',
                              padding: '3px 10px', borderRadius: 20,
                            }}>
                              {isOver ? '⚠️ ' : ''}{empTotal}%
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                            <button onClick={() => startEdit(entry)} style={{ color: '#adbac9', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, marginRight: 6 }}>✎</button>
                            <button onClick={() => deleteEntry(entry.id)} style={{ color: '#FCA5A5', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}>✕</button>
                          </td>
                        </tr>
                      )
                    })}
                    {projectEntries.length > 0 && (
                      <tr style={{ borderTop: '2px solid #E8ECF0', backgroundColor: '#FAFBFC' }}>
                        <td colSpan={6} style={{ padding: '12px 14px', fontWeight: 700, color: '#1e2c33', fontSize: 12 }}>합계</td>
                        <td style={{ padding: '12px 14px', fontWeight: 700, color: '#1e40af', fontSize: 13 }}>
                          {projectTotalCash > 0 ? formatKRW(projectTotalCash) : '-'}
                        </td>
                        <td style={{ padding: '12px 14px', fontWeight: 700, color: '#047857', fontSize: 13 }}>
                          {projectTotalInkind > 0 ? formatKRW(projectTotalInkind) : '-'}
                        </td>
                        <td colSpan={2} style={{ padding: '12px 14px', fontWeight: 800, color: '#1e2c33', fontSize: 13 }}>
                          {formatKRW(projectTotalCash + projectTotalInkind)}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── 연구원 프로필 모달 ── */}
      {selectedResearcher && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, backdropFilter: 'blur(2px)' }}
          onClick={() => setSelectedResearcher(null)}
        >
          <div
            style={{ background: '#fff', borderRadius: 16, width: 520, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ background: 'linear-gradient(135deg, #1e2c33 0%, #2d4454 100%)', padding: '24px 28px', color: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%', background: 'rgba(255,255,255,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22, fontWeight: 800, flexShrink: 0,
                }}>
                  {selectedResearcher.name[0]}
                </div>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>{selectedResearcher.name}</h2>
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
                    {selectedResearcher.position} · {selectedResearcher.researchField}
                  </p>
                </div>
                <button onClick={() => setSelectedResearcher(null)}
                  style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 20 }}>×</button>
              </div>
            </div>

            {/* Body */}
            <div style={{ padding: '20px 28px 28px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <ProfileField label="국가연구자번호" value={selectedResearcher.nationalResearcherId || '미등록'} highlight />
                <ProfileField label="생년월일" value={selectedResearcher.birthDate} />
                <ProfileField label="최종학위" value={selectedResearcher.degree} />
                <ProfileField label="전공" value={selectedResearcher.major || '-'} />
                <ProfileField label="취득년도" value={selectedResearcher.degreeYear} />
                <ProfileField label="출신학교" value={selectedResearcher.university || '-'} />
              </div>

              <div style={{ marginTop: 16 }}>
                <ProfileField label="연구담당분야" value={selectedResearcher.researchField} />
              </div>
              <div style={{ marginTop: 12 }}>
                <ProfileField label="학력 및 경력" value={selectedResearcher.career || '-'} />
              </div>

              {/* 참여 과제 현황 */}
              {(() => {
                const emp = employeeSummary.find(e => e.name === selectedResearcher.name)
                if (!emp) return null
                const piLeadTotal = emp.piLeadActiveCount + emp.piLeadAppliedCount
                return (
                  <div style={{ marginTop: 20 }}>
                    {/* 3책5공 경고 */}
                    {(piLeadTotal > 3 || emp.projectCount > 5) && (
                      <div style={{ padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, marginBottom: 12, fontSize: 12, color: '#DC2626', fontWeight: 600 }}>
                        ⚠️ {piLeadTotal > 3 ? `3책 위반 (주관 연구책임자 ${piLeadTotal}건)` : ''}{piLeadTotal > 3 && emp.projectCount > 5 ? ' / ' : ''}{emp.projectCount > 5 ? `5공 위반 (참여과제 ${emp.projectCount}건)` : ''}
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                      <p style={{ fontSize: 11, color: '#adbac9', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        참여 과제 현황 · 합계 {emp.total}%
                      </p>
                      {emp.piLeadActiveCount > 0 && (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, backgroundColor: '#DC262620', color: '#DC2626' }}>
                          🔴 주관수행 {emp.piLeadActiveCount}
                        </span>
                      )}
                      {emp.piLeadAppliedCount > 0 && (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, backgroundColor: '#F9731620', color: '#EA580C' }}>
                          🟠 주관신청 {emp.piLeadAppliedCount}
                        </span>
                      )}
                      {emp.piSubCount > 0 && (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, backgroundColor: '#3B82F620', color: '#2563EB' }}>
                          🔵 공동/위탁 {emp.piSubCount}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {emp.projects.map((p, i) => {
                        const isPi = p.role === '연구책임자'
                        const isLead = PI_3CHAEK_TYPES.includes(p.implType ?? '')
                        const isPerforming = isPi && PERFORMING_STATUSES.includes(p.projectStatus ?? '')
                        const isApplied = isPi && !isPerforming
                        return (
                          <div key={i} style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '8px 12px', borderRadius: 8,
                            background: isPi && isLead ? (isPerforming ? '#DC262608' : '#F9731608') : isPi ? '#3B82F608' : '#F9FAFB',
                            border: isPi ? `1.5px solid ${isLead ? (isPerforming ? '#DC262630' : '#F9731630') : '#3B82F630'}` : '1px solid #F0F3F6',
                          }}>
                            <div style={{ flex: 1 }}>
                              {isPi && isLead && <span style={{ marginRight: 4 }}>{isPerforming ? '🔴' : '🟠'}</span>}
                              {isPi && !isLead && <span style={{ marginRight: 4 }}>🔵</span>}
                              {p.implType && <span style={{ fontSize: 10, marginRight: 4, opacity: 0.7 }}>[{p.implType}]</span>}
                              <span style={{ fontSize: 13, fontWeight: 600, color: isPi && isLead ? (isPerforming ? '#DC2626' : '#EA580C') : isPi ? '#2563EB' : '#1e2c33' }}>{p.name}</span>
                              <span style={{ fontSize: 11, color: '#adbac9', marginLeft: 8 }}>
                                {isPi ? (isLead ? (isPerforming ? '주관 수행 책임자' : '주관 신청 책임자') : '공동/위탁 책임자') : (p.role ?? '참여연구원')}
                              </span>
                            </div>
                            <span style={{ fontSize: 14, fontWeight: 800, color: '#1e2c33' }}>{p.rate}%</span>
                            {p.pay_type && (
                              <span style={{
                                fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4,
                                background: p.pay_type === '현물' ? '#F0FDF4' : '#EFF6FF',
                                color: p.pay_type === '현물' ? '#047857' : '#1e40af',
                              }}>{p.pay_type}</span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    {/* Progress bar */}
                    <div style={{ marginTop: 10 }}>
                      <div style={{ height: 8, background: '#F0F3F6', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{
                          width: `${Math.min(emp.total, 100)}%`, height: '100%', borderRadius: 4,
                          background: emp.total > 100 ? '#EF4444' : emp.total >= 80 ? '#F97316' : '#1e2c33',
                        }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                        <span style={{ fontSize: 11, color: '#adbac9' }}>0%</span>
                        <span style={{
                          fontSize: 12, fontWeight: 700,
                          color: emp.total > 100 ? '#DC2626' : '#1e2c33',
                        }}>{emp.total}%</span>
                        <span style={{ fontSize: 11, color: '#adbac9' }}>100%</span>
                      </div>
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ProfileField({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p style={{ fontSize: 11, color: '#adbac9', fontWeight: 600, marginBottom: 3 }}>{label}</p>
      <p style={{
        fontSize: 14, fontWeight: highlight ? 700 : 500,
        color: highlight ? '#1e40af' : '#1e2c33',
        background: highlight ? '#EFF6FF' : undefined,
        padding: highlight ? '4px 8px' : undefined,
        borderRadius: highlight ? 6 : undefined,
        display: highlight ? 'inline-block' : undefined,
      }}>
        {value}
      </p>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  fontSize: 11, color: '#adbac9', fontWeight: 600, display: 'block', marginBottom: 4,
}
const inputStyle: React.CSSProperties = {
  padding: '9px 12px', border: '1px solid #E8ECF0', borderRadius: 8,
  fontSize: 13, outline: 'none', fontFamily: 'inherit', color: '#1e2c33',
  backgroundColor: '#fff', width: '100%', boxSizing: 'border-box',
}
const btnPrimary: React.CSSProperties = {
  padding: '8px 16px', borderRadius: 8, backgroundColor: '#1e2c33', color: '#fff',
  fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
}
const btnSecondary: React.CSSProperties = {
  padding: '8px 16px', borderRadius: 8, backgroundColor: '#fff', color: '#707d89',
  fontSize: 12, fontWeight: 600, border: '1px solid #E8ECF0', cursor: 'pointer', fontFamily: 'inherit',
}
