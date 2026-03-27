'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { Project } from '@/types/project'

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
const ACTIVE_STATUSES = ['최종 선정', '최종선정', '서류 통과', '서류통과', '제출 완료', '지원완료', '지원예정']

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
      supabase.from('projects').select('*').in('status', ACTIVE_STATUSES).order('project_name'),
      supabase.from('participation_rates').select('*').order('employee_name'),
    ]).then(([p, r]) => {
      const list = p.data ?? []
      setProjects(list)
      if (list.length > 0) setSelectedProjectId(list[0].id)
      setEntries((r.data ?? []) as ParticipationEntry[])
      setLoading(false)
    })
  }, [])

  // 인력별 집계
  const employeeSummary = useMemo(() => {
    const map: Record<string, {
      total: number
      totalLaborCost: number
      cashLaborCost: number
      inkindLaborCost: number
      projects: {
        id: string
        name: string
        rate: number
        role: string | null
        laborCost: number
        pay_type: string | null
        months: number | null
      }[]
    }> = {}

    entries.forEach(e => {
      const project = projects.find(p => p.id === e.project_id)
      const laborCost = calcLaborCost(e.annual_salary ?? 0, e.rate, e.period_months ?? 0)
      if (!map[e.employee_name]) {
        map[e.employee_name] = { total: 0, totalLaborCost: 0, cashLaborCost: 0, inkindLaborCost: 0, projects: [] }
      }
      map[e.employee_name].total += e.rate
      map[e.employee_name].totalLaborCost += laborCost
      if (e.pay_type === '현물') {
        map[e.employee_name].inkindLaborCost += laborCost
      } else {
        map[e.employee_name].cashLaborCost += laborCost
      }
      map[e.employee_name].projects.push({
        id: e.project_id,
        name: project?.project_name ?? '(삭제된 과제)',
        rate: e.rate,
        role: e.role,
        laborCost,
        pay_type: e.pay_type,
        months: e.period_months,
      })
    })

    return Object.entries(map)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.total - a.total)
  }, [entries, projects])

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

  if (loading) return <div style={{ padding: 40, color: '#adbac9' }}>불러오는 중...</div>

  const totalOverCount = employeeSummary.filter(e => e.total > 100).length
  const grandTotalLaborCost = employeeSummary.reduce((s, e) => s + e.totalLaborCost, 0)

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
                      {['이름', '참여율 현황', '현금 인건비', '현물 인건비', '총 인건비', '참여 과제'].map(h => (
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{
                                width: 32, height: 32, borderRadius: '50%',
                                backgroundColor: isOver ? '#FEF2F2' : '#F5F7FA',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 13, fontWeight: 700, color: isOver ? '#DC2626' : '#1e2c33', flexShrink: 0,
                              }}>
                                {emp.name[0]}
                              </div>
                              <span style={{ fontWeight: 700, color: '#1e2c33', fontSize: 14 }}>{emp.name}</span>
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
                          <td style={{ padding: '14px 16px', color: '#1e40af', fontWeight: 600, fontSize: 12 }}>
                            {emp.cashLaborCost > 0 ? formatKRW(emp.cashLaborCost) : '-'}
                          </td>
                          <td style={{ padding: '14px 16px', color: '#047857', fontWeight: 600, fontSize: 12 }}>
                            {emp.inkindLaborCost > 0 ? formatKRW(emp.inkindLaborCost) : '-'}
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <span style={{ fontWeight: 700, color: '#1e2c33', fontSize: 13 }}>
                              {emp.totalLaborCost > 0 ? formatKRW(emp.totalLaborCost) : '-'}
                            </span>
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              {emp.projects.map((p, i) => (
                                <span key={i} style={{
                                  fontSize: 11, padding: '3px 8px', borderRadius: 6,
                                  backgroundColor: '#F5F7FA', color: '#384e5d', whiteSpace: 'nowrap',
                                }}>
                                  {p.name} <strong>{p.rate}%</strong>
                                  {p.pay_type && <span style={{ color: p.pay_type === '현물' ? '#047857' : '#3B82F6', marginLeft: 3 }}>({p.pay_type})</span>}
                                </span>
                              ))}
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
                onChange={e => { setSelectedProjectId(e.target.value); setShowForm(false) }}
                className="project-select"
              >
                {projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
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

            <div style={{ backgroundColor: '#fff', borderRadius: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
              {/* 헤더 */}
              <div style={{ padding: '18px 20px', borderBottom: '1px solid #F0F3F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1e2c33' }}>인력 참여율 · 인건비</h2>
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
                          <td style={{ padding: '12px 14px', fontWeight: 700, color: '#1e2c33' }}>{entry.employee_name}</td>
                          <td style={{ padding: '12px 14px' }}>
                            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, backgroundColor: '#F5F7FA', color: '#384e5d', fontWeight: 600 }}>
                              {entry.role ?? '-'}
                            </span>
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
