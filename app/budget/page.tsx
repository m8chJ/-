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
  created_at: string
}

type Expense = {
  id: string
  project_id: string
  budget_item_id: string | null
  category: string
  expense_date: string
  description: string
  vendor: string | null
  amount: number
  created_at: string
}

const BUDGET_CATEGORIES = ['인건비', '연구재료비', '연구활동비', '위탁연구비', '간접비', '기타']

const ACTIVE_STATUSES = ['최종 선정', '최종선정', '서류 통과', '서류통과', '제출 완료', '지원완료']

function fmt만(n: number) {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}억`
  return `${n.toLocaleString()}만`
}

export default function BudgetPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)

  // 비목 추가 폼
  const [showBudgetForm, setShowBudgetForm] = useState(false)
  const [budgetForm, setBudgetForm] = useState({ category: '인건비', planned_amount: '', note: '' })
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null)

  // 집행 추가 폼
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [expenseForm, setExpenseForm] = useState({
    category: '인건비', expense_date: new Date().toISOString().slice(0, 10),
    description: '', vendor: '', amount: '',
  })

  useEffect(() => {
    supabase.from('projects').select('*')
      .in('status', ACTIVE_STATUSES)
      .order('project_name')
      .then(({ data }) => {
        const list = data ?? []
        setProjects(list)
        if (list.length > 0) setSelectedProjectId(list[0].id)
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    if (!selectedProjectId) return
    Promise.all([
      supabase.from('budget_items').select('*').eq('project_id', selectedProjectId).order('created_at'),
      supabase.from('expenses').select('*').eq('project_id', selectedProjectId).order('expense_date', { ascending: false }),
    ]).then(([b, e]) => {
      setBudgetItems(b.data ?? [])
      setExpenses(e.data ?? [])
    })
  }, [selectedProjectId])

  const selectedProject = projects.find(p => p.id === selectedProjectId)

  const budgetSummary = useMemo(() => {
    const totalPlanned = budgetItems.reduce((s, b) => s + b.planned_amount, 0)
    const totalExecuted = expenses.reduce((s, e) => s + e.amount, 0)
    return { totalPlanned, totalExecuted, remaining: totalPlanned - totalExecuted }
  }, [budgetItems, expenses])

  const executedByCategory = useMemo(() => {
    const map: Record<string, number> = {}
    expenses.forEach(e => { map[e.category] = (map[e.category] ?? 0) + e.amount })
    return map
  }, [expenses])

  async function saveBudgetItem() {
    if (!selectedProjectId || !budgetForm.planned_amount) return
    const data = {
      project_id: selectedProjectId,
      category: budgetForm.category,
      planned_amount: Number(budgetForm.planned_amount),
      note: budgetForm.note || null,
    }
    if (editingBudgetId) {
      await supabase.from('budget_items').update(data).eq('id', editingBudgetId)
      setBudgetItems(prev => prev.map(b => b.id === editingBudgetId ? { ...b, ...data } : b))
    } else {
      const { data: inserted } = await supabase.from('budget_items').insert(data).select().single()
      if (inserted) setBudgetItems(prev => [...prev, inserted])
    }
    setShowBudgetForm(false)
    setBudgetForm({ category: '인건비', planned_amount: '', note: '' })
    setEditingBudgetId(null)
  }

  async function deleteBudgetItem(id: string) {
    if (!confirm('이 비목을 삭제하면 관련 집행내역도 영향을 받습니다. 삭제할까요?')) return
    await supabase.from('budget_items').delete().eq('id', id)
    setBudgetItems(prev => prev.filter(b => b.id !== id))
  }

  async function saveExpense() {
    if (!selectedProjectId || !expenseForm.amount || !expenseForm.description) return
    const data = {
      project_id: selectedProjectId,
      category: expenseForm.category,
      expense_date: expenseForm.expense_date,
      description: expenseForm.description,
      vendor: expenseForm.vendor || null,
      amount: Number(expenseForm.amount),
    }
    const { data: inserted } = await supabase.from('expenses').insert(data).select().single()
    if (inserted) setExpenses(prev => [inserted, ...prev])
    setShowExpenseForm(false)
    setExpenseForm({ category: '인건비', expense_date: new Date().toISOString().slice(0, 10), description: '', vendor: '', amount: '' })
  }

  async function deleteExpense(id: string) {
    await supabase.from('expenses').delete().eq('id', id)
    setExpenses(prev => prev.filter(e => e.id !== id))
  }

  if (loading) return <div style={{ padding: 40, color: '#adbac9' }}>불러오는 중...</div>

  return (
    <div style={{ minHeight: '100vh' }}>
      <div style={{ padding: '28px 32px 0' }}>
        <p style={{ fontSize: 12, color: '#adbac9', marginBottom: 4 }}>과제별 예산 및 집행 관리</p>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1e2c33', letterSpacing: '-0.5px' }}>사업비 관리</h1>
      </div>

      <div style={{ padding: '20px 32px 32px' }}>
        {/* 프로젝트 선택 */}
        <div style={{ marginBottom: 20 }}>
          <select
            value={selectedProjectId ?? ''}
            onChange={e => setSelectedProjectId(e.target.value)}
            style={{
              padding: '10px 16px', border: '1px solid #E8ECF0', borderRadius: 10,
              fontSize: 14, fontWeight: 600, color: '#1e2c33', backgroundColor: '#fff',
              fontFamily: 'inherit', outline: 'none', minWidth: 300,
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            }}
          >
            {projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
          </select>
          {projects.length === 0 && (
            <p style={{ fontSize: 13, color: '#adbac9', marginTop: 8 }}>최종 선정 또는 진행 중인 과제가 없습니다.</p>
          )}
        </div>

        {selectedProject && (
          <>
            {/* 요약 배너 */}
            <div style={{
              background: 'linear-gradient(135deg, #1e2c33 0%, #384e5d 100%)',
              borderRadius: 16, padding: '24px 28px', marginBottom: 20,
              boxShadow: '0 4px 20px rgba(30,44,51,0.2)',
            }}>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 12 }}>{selectedProject.project_name}</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
                {[
                  { label: '총 계획액', value: fmt만(budgetSummary.totalPlanned), sub: '비목 합산' },
                  { label: '집행액', value: fmt만(budgetSummary.totalExecuted), sub: `${budgetSummary.totalPlanned > 0 ? ((budgetSummary.totalExecuted / budgetSummary.totalPlanned) * 100).toFixed(1) : 0}% 집행` },
                  { label: '잔액', value: fmt만(budgetSummary.remaining), sub: budgetSummary.remaining < 0 ? '⚠️ 초과' : '사용 가능' },
                ].map(s => (
                  <div key={s.label}>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>{s.label}</p>
                    <p style={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>{s.value}</p>
                    <p style={{ fontSize: 11, color: s.sub.includes('⚠️') ? '#FCA5A5' : 'rgba(255,255,255,0.4)', marginTop: 2 }}>{s.sub}</p>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              {/* 비목별 예산 */}
              <div style={{ backgroundColor: '#fff', borderRadius: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                <div style={{ padding: '18px 20px', borderBottom: '1px solid #F0F3F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1e2c33' }}>비목별 예산</h2>
                    <p style={{ fontSize: 12, color: '#adbac9', marginTop: 2 }}>단위: 만원</p>
                  </div>
                  <button onClick={() => { setEditingBudgetId(null); setBudgetForm({ category: '인건비', planned_amount: '', note: '' }); setShowBudgetForm(true) }}
                    style={{ padding: '7px 14px', borderRadius: 8, backgroundColor: '#1e2c33', color: '#fff', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                    + 비목 추가
                  </button>
                </div>

                {showBudgetForm && (
                  <div style={{ padding: '16px 20px', backgroundColor: '#F9FAFB', borderBottom: '1px solid #F0F3F6' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                      <select value={budgetForm.category} onChange={e => setBudgetForm(p => ({ ...p, category: e.target.value }))}
                        style={inputStyle}>
                        {BUDGET_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                      </select>
                      <input type="number" placeholder="계획액 (만원)" value={budgetForm.planned_amount}
                        onChange={e => setBudgetForm(p => ({ ...p, planned_amount: e.target.value }))}
                        style={inputStyle} />
                    </div>
                    <input placeholder="메모 (선택)" value={budgetForm.note}
                      onChange={e => setBudgetForm(p => ({ ...p, note: e.target.value }))}
                      style={{ ...inputStyle, width: '100%', marginBottom: 10, boxSizing: 'border-box' as const }} />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={saveBudgetItem} style={btnPrimary}>저장</button>
                      <button onClick={() => setShowBudgetForm(false)} style={btnSecondary}>취소</button>
                    </div>
                  </div>
                )}

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#FAFBFC' }}>
                        {['비목', '계획액', '집행액', '집행률', ''].map(h => (
                          <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600, color: '#adbac9', fontSize: 11, whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {budgetItems.length === 0 ? (
                        <tr><td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: '#adbac9', fontSize: 13 }}>비목을 추가해주세요</td></tr>
                      ) : budgetItems.map(b => {
                        const executed = executedByCategory[b.category] ?? 0
                        const rate = b.planned_amount > 0 ? (executed / b.planned_amount) * 100 : 0
                        return (
                          <tr key={b.id} style={{ borderTop: '1px solid #F5F7FA' }}>
                            <td style={{ padding: '12px 14px', fontWeight: 600, color: '#1e2c33' }}>{b.category}</td>
                            <td style={{ padding: '12px 14px', color: '#384e5d' }}>{b.planned_amount.toLocaleString()}</td>
                            <td style={{ padding: '12px 14px', color: '#384e5d' }}>{executed.toLocaleString()}</td>
                            <td style={{ padding: '12px 14px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 60, height: 6, backgroundColor: '#F0F3F6', borderRadius: 3, overflow: 'hidden' }}>
                                  <div style={{ width: `${Math.min(rate, 100)}%`, height: '100%', backgroundColor: rate > 90 ? '#EF4444' : '#1e2c33', borderRadius: 3 }} />
                                </div>
                                <span style={{ fontSize: 11, color: rate > 90 ? '#EF4444' : '#707d89', fontWeight: 600 }}>{rate.toFixed(0)}%</span>
                              </div>
                            </td>
                            <td style={{ padding: '12px 14px' }}>
                              <button onClick={() => { setEditingBudgetId(b.id); setBudgetForm({ category: b.category, planned_amount: String(b.planned_amount), note: b.note ?? '' }); setShowBudgetForm(true) }}
                                style={{ color: '#adbac9', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, marginRight: 4 }}>✎</button>
                              <button onClick={() => deleteBudgetItem(b.id)}
                                style={{ color: '#FCA5A5', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}>✕</button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 집행내역 */}
              <div style={{ backgroundColor: '#fff', borderRadius: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                <div style={{ padding: '18px 20px', borderBottom: '1px solid #F0F3F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1e2c33' }}>집행내역</h2>
                    <p style={{ fontSize: 12, color: '#adbac9', marginTop: 2 }}>총 {expenses.length}건</p>
                  </div>
                  <button onClick={() => setShowExpenseForm(true)}
                    style={{ padding: '7px 14px', borderRadius: 8, backgroundColor: '#1e2c33', color: '#fff', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                    + 집행 추가
                  </button>
                </div>

                {showExpenseForm && (
                  <div style={{ padding: '16px 20px', backgroundColor: '#F9FAFB', borderBottom: '1px solid #F0F3F6' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                      <select value={expenseForm.category} onChange={e => setExpenseForm(p => ({ ...p, category: e.target.value }))} style={inputStyle}>
                        {BUDGET_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                      </select>
                      <input type="date" value={expenseForm.expense_date} onChange={e => setExpenseForm(p => ({ ...p, expense_date: e.target.value }))} style={inputStyle} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                      <input placeholder="내용 *" value={expenseForm.description} onChange={e => setExpenseForm(p => ({ ...p, description: e.target.value }))} style={inputStyle} />
                      <input placeholder="거래처" value={expenseForm.vendor} onChange={e => setExpenseForm(p => ({ ...p, vendor: e.target.value }))} style={inputStyle} />
                    </div>
                    <input type="number" placeholder="금액 (만원) *" value={expenseForm.amount} onChange={e => setExpenseForm(p => ({ ...p, amount: e.target.value }))}
                      style={{ ...inputStyle, width: '100%', marginBottom: 10, boxSizing: 'border-box' as const }} />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={saveExpense} style={btnPrimary}>저장</button>
                      <button onClick={() => setShowExpenseForm(false)} style={btnSecondary}>취소</button>
                    </div>
                  </div>
                )}

                <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                  <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                    <thead style={{ position: 'sticky', top: 0, backgroundColor: '#FAFBFC', zIndex: 1 }}>
                      <tr>
                        {['날짜', '비목', '내용', '거래처', '금액', ''].map(h => (
                          <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600, color: '#adbac9', fontSize: 11, whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {expenses.length === 0 ? (
                        <tr><td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: '#adbac9', fontSize: 13 }}>집행내역이 없습니다</td></tr>
                      ) : expenses.map(e => (
                        <tr key={e.id} style={{ borderTop: '1px solid #F5F7FA' }}>
                          <td style={{ padding: '10px 14px', color: '#707d89', whiteSpace: 'nowrap' }}>{e.expense_date}</td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, backgroundColor: '#F5F7FA', color: '#384e5d', fontWeight: 600 }}>{e.category}</span>
                          </td>
                          <td style={{ padding: '10px 14px', color: '#1e2c33', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.description}</td>
                          <td style={{ padding: '10px 14px', color: '#707d89', whiteSpace: 'nowrap' }}>{e.vendor ?? '-'}</td>
                          <td style={{ padding: '10px 14px', fontWeight: 700, color: '#1e2c33', whiteSpace: 'nowrap' }}>{e.amount.toLocaleString()}만</td>
                          <td style={{ padding: '10px 14px' }}>
                            <button onClick={() => deleteExpense(e.id)} style={{ color: '#FCA5A5', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}>✕</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
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
