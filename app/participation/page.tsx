'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { Project } from '@/types/project'

type ParticipationRate = {
  id: string
  project_id: string
  employee_name: string
  role: string | null
  rate: number
  period_start: string | null
  period_end: string | null
  created_at: string
}

const ROLES = ['연구책임자', '참여연구원', '위탁연구원', '보조연구원', '행정지원']
const ACTIVE_STATUSES = ['최종 선정', '최종선정', '서류 통과', '서류통과', '제출 완료', '지원완료', '지원예정']

export default function ParticipationPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [rates, setRates] = useState<ParticipationRate[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    employee_name: '',
    role: '참여연구원',
    rate: '',
    period_start: '',
    period_end: '',
  })
  const [viewMode, setViewMode] = useState<'employee' | 'project'>('employee')

  useEffect(() => {
    Promise.all([
      supabase.from('projects').select('*').in('status', ACTIVE_STATUSES).order('project_name'),
      supabase.from('participation_rates').select('*').order('employee_name'),
    ]).then(([p, r]) => {
      const list = p.data ?? []
      setProjects(list)
      if (list.length > 0) setSelectedProjectId(list[0].id)
      setRates(r.data ?? [])
      setLoading(false)
    })
  }, [])

  // 인력별 총 참여율 집계
  const employeeSummary = useMemo(() => {
    const map: Record<string, { total: number; projects: { name: string; rate: number; role: string | null }[] }> = {}
    rates.forEach(r => {
      const project = projects.find(p => p.id === r.project_id)
      if (!map[r.employee_name]) map[r.employee_name] = { total: 0, projects: [] }
      map[r.employee_name].total += r.rate
      map[r.employee_name].projects.push({
        name: project?.project_name ?? '(삭제된 과제)',
        rate: r.rate,
        role: r.role,
      })
    })
    return Object.entries(map)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.total - a.total)
  }, [rates, projects])

  const projectRates = rates.filter(r => r.project_id === selectedProjectId)
  const projectTotal = projectRates.reduce((s, r) => s + r.rate, 0)

  async function saveRate() {
    if (!selectedProjectId || !form.employee_name || !form.rate) return
    const data = {
      project_id: selectedProjectId,
      employee_name: form.employee_name,
      role: form.role || null,
      rate: Number(form.rate),
      period_start: form.period_start || null,
      period_end: form.period_end || null,
    }
    if (editingId) {
      await supabase.from('participation_rates').update(data).eq('id', editingId)
      setRates(prev => prev.map(r => r.id === editingId ? { ...r, ...data } : r))
    } else {
      const { data: inserted } = await supabase.from('participation_rates').insert(data).select().single()
      if (inserted) setRates(prev => [...prev, inserted])
    }
    resetForm()
  }

  async function deleteRate(id: string) {
    await supabase.from('participation_rates').delete().eq('id', id)
    setRates(prev => prev.filter(r => r.id !== id))
  }

  function resetForm() {
    setShowForm(false)
    setEditingId(null)
    setForm({ employee_name: '', role: '참여연구원', rate: '', period_start: '', period_end: '' })
  }

  function startEdit(r: ParticipationRate) {
    setEditingId(r.id)
    setSelectedProjectId(r.project_id)
    setForm({
      employee_name: r.employee_name,
      role: r.role ?? '참여연구원',
      rate: String(r.rate),
      period_start: r.period_start ?? '',
      period_end: r.period_end ?? '',
    })
    setShowForm(true)
    setViewMode('project')
  }

  if (loading) return <div style={{ padding: 40, color: '#adbac9' }}>불러오는 중...</div>

  return (
    <div style={{ minHeight: '100vh' }}>
      <div style={{ padding: '28px 32px 0' }}>
        <p style={{ fontSize: 12, color: '#adbac9', marginBottom: 4 }}>인력별 과제 참여율 관리 (합계 100% 이하)</p>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1e2c33', letterSpacing: '-0.5px' }}>참여율 관리</h1>
      </div>

      <div style={{ padding: '20px 32px 32px' }}>
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
          /* 인력별 현황 */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {employeeSummary.length === 0 ? (
              <div style={{ backgroundColor: '#fff', borderRadius: 16, padding: '60px 0', textAlign: 'center', color: '#adbac9', fontSize: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                <p style={{ marginBottom: 16 }}>등록된 참여율 데이터가 없습니다</p>
                <button onClick={() => setViewMode('project')}
                  style={{ padding: '10px 20px', borderRadius: 10, backgroundColor: '#1e2c33', color: '#fff', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                  과제별 입력으로 이동
                </button>
              </div>
            ) : employeeSummary.map(emp => {
              const isOver = emp.total > 100
              const isWarning = emp.total > 80 && emp.total <= 100
              return (
                <div key={emp.name} style={{ backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: isOver ? '1px solid #FECACA' : '1px solid #F0F3F6' }}>
                  {/* 인력 헤더 */}
                  <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, borderBottom: '1px solid #F5F7FA' }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: '50%',
                      backgroundColor: isOver ? '#FEF2F2' : '#F5F7FA',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 16, fontWeight: 700,
                      color: isOver ? '#DC2626' : '#1e2c33',
                      flexShrink: 0,
                    }}>
                      {emp.name[0]}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: '#1e2c33' }}>{emp.name}</span>
                        {isOver && <span style={{ fontSize: 11, fontWeight: 700, color: '#DC2626', backgroundColor: '#FEF2F2', padding: '2px 8px', borderRadius: 20 }}>⚠️ 초과</span>}
                        {isWarning && <span style={{ fontSize: 11, fontWeight: 700, color: '#D97706', backgroundColor: '#FFFBEB', padding: '2px 8px', borderRadius: 20 }}>주의</span>}
                      </div>
                      <p style={{ fontSize: 12, color: '#adbac9', marginTop: 2 }}>{emp.projects.length}개 과제 참여</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: 28, fontWeight: 800, color: isOver ? '#DC2626' : '#1e2c33', letterSpacing: '-0.5px' }}>
                        {emp.total}%
                      </p>
                      {/* 참여율 바 */}
                      <div style={{ width: 120, height: 6, backgroundColor: '#F0F3F6', borderRadius: 3, overflow: 'hidden', marginTop: 4 }}>
                        <div style={{
                          width: `${Math.min(emp.total, 100)}%`, height: '100%',
                          backgroundColor: isOver ? '#EF4444' : isWarning ? '#F97316' : '#1e2c33',
                          borderRadius: 3,
                        }} />
                      </div>
                    </div>
                  </div>
                  {/* 과제 목록 */}
                  <div style={{ padding: '12px 20px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {emp.projects.map((p, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, backgroundColor: '#F5F7FA', borderRadius: 8, padding: '6px 12px' }}>
                        <span style={{ fontSize: 12, color: '#384e5d', fontWeight: 500, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                        {p.role && <span style={{ fontSize: 10, color: '#adbac9' }}>· {p.role}</span>}
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#1e2c33' }}>{p.rate}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          /* 과제별 입력 */
          <div>
            {/* 과제 선택 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <select value={selectedProjectId ?? ''} onChange={e => setSelectedProjectId(e.target.value)}
                style={{ padding: '10px 16px', border: '1px solid #E8ECF0', borderRadius: 10, fontSize: 14, fontWeight: 600, color: '#1e2c33', backgroundColor: '#fff', fontFamily: 'inherit', outline: 'none', minWidth: 300, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                {projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
              </select>
              {selectedProjectId && (
                <span style={{
                  fontSize: 13, fontWeight: 700,
                  color: projectTotal > 100 ? '#DC2626' : '#1e2c33',
                  backgroundColor: projectTotal > 100 ? '#FEF2F2' : '#F5F7FA',
                  padding: '6px 12px', borderRadius: 8,
                }}>
                  {projectTotal > 100 ? '⚠️' : '총'} {projectTotal}%
                </span>
              )}
            </div>

            <div style={{ backgroundColor: '#fff', borderRadius: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
              <div style={{ padding: '18px 20px', borderBottom: '1px solid #F0F3F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1e2c33' }}>인력 참여율</h2>
                  <p style={{ fontSize: 12, color: '#adbac9', marginTop: 2 }}>인력별 참여율의 합계가 100%를 넘지 않도록 관리하세요</p>
                </div>
                <button onClick={() => { setEditingId(null); setForm({ employee_name: '', role: '참여연구원', rate: '', period_start: '', period_end: '' }); setShowForm(true) }}
                  style={{ padding: '7px 14px', borderRadius: 8, backgroundColor: '#1e2c33', color: '#fff', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                  + 인력 추가
                </button>
              </div>

              {showForm && (
                <div style={{ padding: '16px 20px', backgroundColor: '#F9FAFB', borderBottom: '1px solid #F0F3F6' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                    <input placeholder="이름 *" value={form.employee_name} onChange={e => setForm(p => ({ ...p, employee_name: e.target.value }))} style={inputStyle} />
                    <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))} style={inputStyle}>
                      {ROLES.map(r => <option key={r}>{r}</option>)}
                    </select>
                    <input type="number" placeholder="참여율 (%) *" value={form.rate} onChange={e => setForm(p => ({ ...p, rate: e.target.value }))} style={inputStyle} min={1} max={100} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                    <div>
                      <label style={{ fontSize: 11, color: '#adbac9', fontWeight: 600, display: 'block', marginBottom: 4 }}>참여 시작일</label>
                      <input type="date" value={form.period_start} onChange={e => setForm(p => ({ ...p, period_start: e.target.value }))} style={inputStyle} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: '#adbac9', fontWeight: 600, display: 'block', marginBottom: 4 }}>참여 종료일</label>
                      <input type="date" value={form.period_end} onChange={e => setForm(p => ({ ...p, period_end: e.target.value }))} style={inputStyle} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={saveRate} style={btnPrimary}>저장</button>
                    <button onClick={resetForm} style={btnSecondary}>취소</button>
                  </div>
                </div>
              )}

              <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#FAFBFC' }}>
                    {['이름', '역할', '참여율', '참여 기간', '인력별 합계', ''].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600, color: '#adbac9', fontSize: 11, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {projectRates.length === 0 ? (
                    <tr><td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: '#adbac9', fontSize: 13 }}>등록된 인력이 없습니다</td></tr>
                  ) : projectRates.map(r => {
                    const empTotal = employeeSummary.find(e => e.name === r.employee_name)?.total ?? r.rate
                    const isOver = empTotal > 100
                    return (
                      <tr key={r.id} style={{ borderTop: '1px solid #F5F7FA' }}>
                        <td style={{ padding: '12px 14px', fontWeight: 700, color: '#1e2c33' }}>{r.employee_name}</td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, backgroundColor: '#F5F7FA', color: '#384e5d', fontWeight: 600 }}>{r.role ?? '-'}</span>
                        </td>
                        <td style={{ padding: '12px 14px', fontWeight: 700, color: '#1e2c33', fontSize: 15 }}>{r.rate}%</td>
                        <td style={{ padding: '12px 14px', color: '#707d89', fontSize: 12 }}>
                          {r.period_start && r.period_end
                            ? `${r.period_start} ~ ${r.period_end}`
                            : r.period_start ? `${r.period_start} ~` : '-'}
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
                        <td style={{ padding: '12px 14px' }}>
                          <button onClick={() => startEdit(r)} style={{ color: '#adbac9', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, marginRight: 6 }}>✎</button>
                          <button onClick={() => deleteRate(r.id)} style={{ color: '#FCA5A5', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}>✕</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
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
