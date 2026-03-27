'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { Project } from '@/types/project'

type BudgetItem = {
  id: string
  project_id: string
  category: string
  planned_amount: number
  note: string | null
}

type Expense = {
  id: string
  project_id: string
  category: string
  expense_date: string
  description: string
  vendor: string | null
  amount: number
  supply_amount?: number
  vat_amount?: number
  internal_ref?: string
  transfer_date?: string
}

const BUDGET_CATEGORIES = [
  { group: '인건비', items: ['현금 인건비', '현물 인건비'] },
  { group: '연구장비·재료비', items: ['장비 및 시설', '시제품 제작비', '연구재료비', '시약 및 재료비'] },
  { group: '연구활동비', items: ['수용비 및 수수료', '연구개발서비스 활용비', '연구수당', '외주용역비'] },
  { group: '간접비', items: ['간접비'] },
  { group: '기타', items: ['기타'] },
]
const ALL_CATEGORIES = BUDGET_CATEGORIES.flatMap(g => g.items)
const ACTIVE_STATUSES = ['최종 선정', '최종선정', '서류 통과', '서류통과', '제출 완료', '지원완료']

const GROUP_COLORS: Record<string, { bg: string; color: string }> = {
  '인건비': { bg: '#EFF6FF', color: '#2563EB' },
  '연구장비·재료비': { bg: '#F5F3FF', color: '#7C3AED' },
  '연구활동비': { bg: '#ECFDF3', color: '#059669' },
  '간접비': { bg: '#FFF7ED', color: '#D97706' },
  '기타': { bg: '#F5F5F5', color: '#6B7280' },
}

function getGroup(category: string) {
  return BUDGET_CATEGORIES.find(g => g.items.includes(category))?.group ?? '기타'
}

function fmtKRW(n: number) {
  if (!n) return '-'
  if (n >= 100000000) return `${(n / 100000000).toFixed(2)}억`
  if (n >= 10000) return `${Math.round(n / 10000).toLocaleString()}만`
  return `${n.toLocaleString()}원`
}

export default function BudgetPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'budget' | 'expense'>('budget')

  // 비목 폼
  const [showBudgetForm, setShowBudgetForm] = useState(false)
  const [editBudgetId, setEditBudgetId] = useState<string | null>(null)
  const [bf, setBf] = useState({ category: '현금 인건비', planned_amount: '', note: '' })

  // 집행 폼
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [ef, setEf] = useState({
    category: '현금 인건비',
    expense_date: new Date().toISOString().slice(0, 10),
    description: '', vendor: '',
    supply_amount: '', vat_amount: '0',
    internal_ref: '', transfer_date: '',
  })

  useEffect(() => {
    supabase.from('projects').select('*').in('status', ACTIVE_STATUSES).order('project_name')
      .then(({ data }) => {
        const list = data ?? []
        setProjects(list)
        if (list.length > 0) setSelectedId(list[0].id)
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    if (!selectedId) return
    Promise.all([
      supabase.from('budget_items').select('*').eq('project_id', selectedId).order('created_at'),
      supabase.from('expenses').select('*').eq('project_id', selectedId).order('expense_date', { ascending: false }),
    ]).then(([b, e]) => { setBudgetItems(b.data ?? []); setExpenses(e.data ?? []) })
  }, [selectedId])

  const selectedProject = projects.find(p => p.id === selectedId)

  const summary = useMemo(() => {
    const totalPlanned = budgetItems.reduce((s, b) => s + b.planned_amount, 0)
    const totalExecuted = expenses.reduce((s, e) => s + e.amount, 0)
    const byGroup: Record<string, { planned: number; executed: number }> = {}
    budgetItems.forEach(b => {
      const g = getGroup(b.category)
      if (!byGroup[g]) byGroup[g] = { planned: 0, executed: 0 }
      byGroup[g].planned += b.planned_amount
    })
    expenses.forEach(e => {
      const g = getGroup(e.category)
      if (!byGroup[g]) byGroup[g] = { planned: 0, executed: 0 }
      byGroup[g].executed += e.amount
    })
    return { totalPlanned, totalExecuted, remaining: totalPlanned - totalExecuted, byGroup }
  }, [budgetItems, expenses])

  const executedByCategory = useMemo(() => {
    const map: Record<string, number> = {}
    expenses.forEach(e => { map[e.category] = (map[e.category] ?? 0) + e.amount })
    return map
  }, [expenses])

  async function saveBudget() {
    if (!selectedId || !bf.planned_amount) return
    const data = { project_id: selectedId, category: bf.category, planned_amount: Number(bf.planned_amount), note: bf.note || null }
    if (editBudgetId) {
      await supabase.from('budget_items').update(data).eq('id', editBudgetId)
      setBudgetItems(prev => prev.map(b => b.id === editBudgetId ? { ...b, ...data } : b))
    } else {
      const { data: ins } = await supabase.from('budget_items').insert(data).select().single()
      if (ins) setBudgetItems(prev => [...prev, ins])
    }
    setShowBudgetForm(false); setBf({ category: '현금 인건비', planned_amount: '', note: '' }); setEditBudgetId(null)
  }

  async function deleteBudget(id: string) {
    if (!confirm('삭제할까요?')) return
    await supabase.from('budget_items').delete().eq('id', id)
    setBudgetItems(prev => prev.filter(b => b.id !== id))
  }

  async function saveExpense() {
    if (!selectedId || !ef.description || !ef.supply_amount) return
    const supply = Number(ef.supply_amount)
    const vat = Number(ef.vat_amount || 0)
    const data = {
      project_id: selectedId,
      category: ef.category,
      expense_date: ef.expense_date,
      description: ef.description,
      vendor: ef.vendor || null,
      amount: supply + vat,
    }
    const { data: ins } = await supabase.from('expenses').insert(data).select().single()
    if (ins) setExpenses(prev => [{ ...ins, supply_amount: supply, vat_amount: vat, internal_ref: ef.internal_ref, transfer_date: ef.transfer_date }, ...prev])
    setShowExpenseForm(false)
    setEf({ category: '현금 인건비', expense_date: new Date().toISOString().slice(0, 10), description: '', vendor: '', supply_amount: '', vat_amount: '0', internal_ref: '', transfer_date: '' })
  }

  async function deleteExpense(id: string) {
    await supabase.from('expenses').delete().eq('id', id)
    setExpenses(prev => prev.filter(e => e.id !== id))
  }

  if (loading) return <div style={{ padding: 40, color: '#adbac9' }}>불러오는 중...</div>

  return (
    <div style={{ minHeight: '100vh' }}>
      <div className="page-header">
        <p style={{ fontSize: 12, color: '#adbac9', marginBottom: 4 }}>비목별 예산 및 집행내역 관리</p>
        <h1 className="page-title" style={{ fontSize: 22, fontWeight: 700, color: '#1e2c33', letterSpacing: '-0.5px' }}>사업비 관리</h1>
      </div>

      <div className="page-body">
        {/* 과제 선택 */}
        <div style={{ marginBottom: 20 }}>
          <select value={selectedId ?? ''} onChange={e => setSelectedId(e.target.value)}
            style={{ padding: '10px 16px', border: '1px solid #E8ECF0', borderRadius: 10, fontSize: 14, fontWeight: 600, color: '#1e2c33', backgroundColor: '#fff', fontFamily: 'inherit', outline: 'none', minWidth: 340, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            {projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
          </select>
          {projects.length === 0 && <p style={{ fontSize: 13, color: '#adbac9', marginTop: 8 }}>진행 중인 과제가 없습니다.</p>}
        </div>

        {selectedProject && (<>
          {/* 히어로 배너 */}
          <div className="hero-banner" style={{ background: 'linear-gradient(135deg, #1e2c33 0%, #384e5d 100%)', borderRadius: 16, padding: '24px 28px', marginBottom: 20, boxShadow: '0 4px 20px rgba(30,44,51,0.2)' }}>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 14 }}>{selectedProject.project_name}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24 }}>
              {[
                { label: '총 계획액', value: fmtKRW(summary.totalPlanned), sub: `${budgetItems.length}개 비목`, color: 'rgba(255,255,255,0.4)' },
                { label: '집행액', value: fmtKRW(summary.totalExecuted), sub: summary.totalPlanned > 0 ? `${((summary.totalExecuted / summary.totalPlanned) * 100).toFixed(1)}% 집행` : '0% 집행', color: 'rgba(255,255,255,0.4)' },
                { label: '잔액', value: fmtKRW(Math.abs(summary.remaining)), sub: summary.remaining < 0 ? '⚠️ 예산 초과' : '사용 가능', color: summary.remaining < 0 ? '#FCA5A5' : 'rgba(255,255,255,0.4)' },
              ].map(s => (
                <div key={s.label}>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>{s.label}</p>
                  <p style={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>{s.value}</p>
                  <p style={{ fontSize: 11, color: s.color, marginTop: 2 }}>{s.sub}</p>
                </div>
              ))}
            </div>

            {/* 대분류별 진행 바 */}
            {Object.keys(summary.byGroup).length > 0 && (
              <div style={{ marginTop: 20, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {BUDGET_CATEGORIES.map(g => {
                  const data = summary.byGroup[g.group]
                  if (!data || data.planned === 0) return null
                  const rate = (data.executed / data.planned) * 100
                  const c = GROUP_COLORS[g.group]
                  return (
                    <div key={g.group} style={{ backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 10, padding: '10px 14px', minWidth: 130 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{g.group}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: rate > 90 ? '#FCA5A5' : 'rgba(255,255,255,0.8)' }}>{rate.toFixed(0)}%</span>
                      </div>
                      <div style={{ height: 4, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(rate, 100)}%`, height: '100%', backgroundColor: rate > 90 ? '#EF4444' : '#fff', borderRadius: 2 }} />
                      </div>
                      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>{fmtKRW(data.executed)} / {fmtKRW(data.planned)}</p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* 탭 */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {[{ key: 'budget', label: '비목별 예산' }, { key: 'expense', label: '집행내역' }].map(t => (
              <button key={t.key} onClick={() => setActiveTab(t.key as 'budget' | 'expense')}
                style={{ padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: activeTab === t.key ? 'none' : '1px solid #E8ECF0', backgroundColor: activeTab === t.key ? '#1e2c33' : '#fff', color: activeTab === t.key ? '#fff' : '#707d89' }}>
                {t.label}
              </button>
            ))}
          </div>

          {activeTab === 'budget' ? (
            /* 비목별 예산 */
            <div style={{ backgroundColor: '#fff', borderRadius: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
              <div style={{ padding: '18px 20px', borderBottom: '1px solid #F0F3F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1e2c33' }}>비목별 계획액</h2>
                <button onClick={() => { setEditBudgetId(null); setBf({ category: '현금 인건비', planned_amount: '', note: '' }); setShowBudgetForm(true) }}
                  style={btnPrimaryStyle}>+ 비목 추가</button>
              </div>

              {showBudgetForm && (
                <div style={{ padding: '16px 20px', backgroundColor: '#F9FAFB', borderBottom: '1px solid #F0F3F6' }}>
                  <div className="form-grid-3" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 2fr', gap: 10, marginBottom: 10 }}>
                    <select value={bf.category} onChange={e => setBf(p => ({ ...p, category: e.target.value }))} style={inputStyle}>
                      {BUDGET_CATEGORIES.map(g => (
                        <optgroup key={g.group} label={g.group}>
                          {g.items.map(i => <option key={i}>{i}</option>)}
                        </optgroup>
                      ))}
                    </select>
                    <input type="number" placeholder="계획액 (원)" value={bf.planned_amount} onChange={e => setBf(p => ({ ...p, planned_amount: e.target.value }))} style={inputStyle} />
                    <input placeholder="메모" value={bf.note} onChange={e => setBf(p => ({ ...p, note: e.target.value }))} style={inputStyle} />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={saveBudget} style={btnPrimaryStyle}>저장</button>
                    <button onClick={() => setShowBudgetForm(false)} style={btnSecondaryStyle}>취소</button>
                  </div>
                </div>
              )}

              {BUDGET_CATEGORIES.map(g => {
                const groupItems = budgetItems.filter(b => g.items.includes(b.category))
                if (groupItems.length === 0) return null
                const c = GROUP_COLORS[g.group]
                return (
                  <div key={g.group}>
                    <div style={{ padding: '10px 20px', backgroundColor: '#FAFBFC', borderTop: '1px solid #F0F3F6', borderBottom: '1px solid #F0F3F6' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: c.color, backgroundColor: c.bg, padding: '3px 10px', borderRadius: 6 }}>{g.group}</span>
                    </div>
                    {groupItems.map(b => {
                      const executed = executedByCategory[b.category] ?? 0
                      const rate = b.planned_amount > 0 ? (executed / b.planned_amount) * 100 : 0
                      return (
                        <div key={b.id} style={{ display: 'grid', gridTemplateColumns: '200px 1fr 1fr 140px 80px', alignItems: 'center', padding: '12px 20px', borderBottom: '1px solid #F5F7FA', gap: 16 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#1e2c33' }}>{b.category}</span>
                          <span style={{ fontSize: 13, color: '#384e5d' }}>{b.planned_amount.toLocaleString()}원</span>
                          <span style={{ fontSize: 13, color: '#384e5d' }}>{executed.toLocaleString()}원</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ flex: 1, height: 6, backgroundColor: '#F0F3F6', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{ width: `${Math.min(rate, 100)}%`, height: '100%', backgroundColor: rate > 90 ? '#EF4444' : c.color, borderRadius: 3 }} />
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 700, color: rate > 90 ? '#EF4444' : '#707d89', minWidth: 32 }}>{rate.toFixed(0)}%</span>
                          </div>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button onClick={() => { setEditBudgetId(b.id); setBf({ category: b.category, planned_amount: String(b.planned_amount), note: b.note ?? '' }); setShowBudgetForm(true) }}
                              style={{ color: '#adbac9', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}>✎</button>
                            <button onClick={() => deleteBudget(b.id)} style={{ color: '#FCA5A5', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}>✕</button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })}

              {budgetItems.length === 0 && (
                <div style={{ padding: '40px', textAlign: 'center', color: '#adbac9', fontSize: 13 }}>비목을 추가해주세요</div>
              )}
            </div>
          ) : (
            /* 집행내역 */
            <div style={{ backgroundColor: '#fff', borderRadius: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
              <div style={{ padding: '18px 20px', borderBottom: '1px solid #F0F3F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1e2c33' }}>집행내역</h2>
                  <p style={{ fontSize: 12, color: '#adbac9', marginTop: 2 }}>총 {expenses.length}건 · {fmtKRW(summary.totalExecuted)}</p>
                </div>
                <button onClick={() => setShowExpenseForm(true)} style={btnPrimaryStyle}>+ 집행 추가</button>
              </div>

              {showExpenseForm && (
                <div style={{ padding: '16px 20px', backgroundColor: '#F9FAFB', borderBottom: '1px solid #F0F3F6' }}>
                  <div className="form-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 10 }}>
                    <select value={ef.category} onChange={e => setEf(p => ({ ...p, category: e.target.value }))} style={inputStyle}>
                      {BUDGET_CATEGORIES.map(g => (
                        <optgroup key={g.group} label={g.group}>
                          {g.items.map(i => <option key={i}>{i}</option>)}
                        </optgroup>
                      ))}
                    </select>
                    <input type="date" value={ef.expense_date} onChange={e => setEf(p => ({ ...p, expense_date: e.target.value }))} style={inputStyle} />
                    <input placeholder="이체일자" type="date" value={ef.transfer_date} onChange={e => setEf(p => ({ ...p, transfer_date: e.target.value }))} style={inputStyle} />
                  </div>
                  <div className="form-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 10 }}>
                    <input placeholder="내용 *" value={ef.description} onChange={e => setEf(p => ({ ...p, description: e.target.value }))} style={inputStyle} />
                    <input placeholder="거래처" value={ef.vendor} onChange={e => setEf(p => ({ ...p, vendor: e.target.value }))} style={inputStyle} />
                    <input placeholder="내부결재번호" value={ef.internal_ref} onChange={e => setEf(p => ({ ...p, internal_ref: e.target.value }))} style={inputStyle} />
                  </div>
                  <div className="form-grid-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                    <input type="number" placeholder="공급가액 (원) *" value={ef.supply_amount} onChange={e => setEf(p => ({ ...p, supply_amount: e.target.value }))} style={inputStyle} />
                    <input type="number" placeholder="VAT (원)" value={ef.vat_amount} onChange={e => setEf(p => ({ ...p, vat_amount: e.target.value }))} style={inputStyle} />
                    <div style={{ ...inputStyle, display: 'flex', alignItems: 'center', color: '#384e5d', fontWeight: 700, cursor: 'default' }}>
                      합계: {((Number(ef.supply_amount) || 0) + (Number(ef.vat_amount) || 0)).toLocaleString()}원
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={saveExpense} style={btnPrimaryStyle}>저장</button>
                    <button onClick={() => setShowExpenseForm(false)} style={btnSecondaryStyle}>취소</button>
                  </div>
                </div>
              )}

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#FAFBFC' }}>
                      {['집행일', '비목', '내용', '거래처', '공급가액', 'VAT', '합계', ''].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600, color: '#adbac9', fontSize: 11, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.length === 0 ? (
                      <tr><td colSpan={8} style={{ padding: 32, textAlign: 'center', color: '#adbac9', fontSize: 13 }}>집행내역이 없습니다</td></tr>
                    ) : expenses.map(e => {
                      const supply = e.supply_amount ?? e.amount
                      const vat = e.vat_amount ?? 0
                      const group = getGroup(e.category)
                      const c = GROUP_COLORS[group]
                      return (
                        <tr key={e.id} style={{ borderTop: '1px solid #F5F7FA' }}
                          onMouseEnter={ev => (ev.currentTarget as HTMLElement).style.backgroundColor = '#FAFBFC'}
                          onMouseLeave={ev => (ev.currentTarget as HTMLElement).style.backgroundColor = 'transparent'}>
                          <td style={{ padding: '11px 14px', color: '#707d89', whiteSpace: 'nowrap' }}>{e.expense_date}</td>
                          <td style={{ padding: '11px 14px' }}>
                            <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, backgroundColor: c.bg, color: c.color, fontWeight: 600, whiteSpace: 'nowrap' }}>{e.category}</span>
                          </td>
                          <td style={{ padding: '11px 14px', color: '#1e2c33', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.description}</td>
                          <td style={{ padding: '11px 14px', color: '#707d89', whiteSpace: 'nowrap' }}>{e.vendor ?? '-'}</td>
                          <td style={{ padding: '11px 14px', color: '#384e5d', whiteSpace: 'nowrap' }}>{supply.toLocaleString()}</td>
                          <td style={{ padding: '11px 14px', color: '#adbac9', whiteSpace: 'nowrap' }}>{vat > 0 ? vat.toLocaleString() : '-'}</td>
                          <td style={{ padding: '11px 14px', fontWeight: 700, color: '#1e2c33', whiteSpace: 'nowrap' }}>{e.amount.toLocaleString()}원</td>
                          <td style={{ padding: '11px 14px' }}>
                            <button onClick={() => deleteExpense(e.id)} style={{ color: '#FCA5A5', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}>✕</button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>)}
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '9px 12px', border: '1px solid #E8ECF0', borderRadius: 8,
  fontSize: 13, outline: 'none', fontFamily: 'inherit', color: '#1e2c33',
  backgroundColor: '#fff', width: '100%', boxSizing: 'border-box',
}
const btnPrimaryStyle: React.CSSProperties = {
  padding: '8px 16px', borderRadius: 8, backgroundColor: '#1e2c33', color: '#fff',
  fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
}
const btnSecondaryStyle: React.CSSProperties = {
  padding: '8px 16px', borderRadius: 8, backgroundColor: '#fff', color: '#707d89',
  fontSize: 12, fontWeight: 600, border: '1px solid #E8ECF0', cursor: 'pointer', fontFamily: 'inherit',
}
