'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { Project } from '@/types/project'

type AnnualBudget = {
  label: string    // "1단계"
  period: string   // "2024-11~2024-12"
  gov_cash: number // 정부지원 현금 A (천원)
  org_cash: number // 기관부담 현금 B (천원)
  org_kind: number // 기관부담 현물 C (천원)
}

type ProjectNotes = {
  memo?: string
  annual_budgets?: AnnualBudget[]
}

function parseNotes(notes: string | null): ProjectNotes {
  if (!notes) return {}
  try { return JSON.parse(notes) } catch { return { memo: notes } }
}

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
}

const BUDGET_CATEGORIES = [
  { group: '인건비', items: ['현금 인건비', '현물 인건비'] },
  { group: '연구장비·재료비', items: ['장비 및 시설', '시제품 제작비', '연구재료비', '시약 및 재료비'] },
  { group: '연구활동비', items: ['수용비 및 수수료', '연구개발서비스 활용비', '연구수당', '외주용역비'] },
  { group: '간접비', items: ['간접비'] },
  { group: '기타', items: ['기타'] },
]

// 최종 선정 과제만
const SELECTED_STATUSES = ['최종 선정', '최종선정']

const GROUP_COLORS: Record<string, string> = {
  '인건비': '#2563EB',
  '연구장비·재료비': '#7C3AED',
  '연구활동비': '#059669',
  '간접비': '#D97706',
  '기타': '#6B7280',
}

function getGroup(cat: string) {
  return BUDGET_CATEGORIES.find(g => g.items.includes(cat))?.group ?? '기타'
}

function fmtKRW(n: number) {
  if (!n) return '-'
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}억`
  if (n >= 10000) return `${Math.round(n / 10000).toLocaleString()}만`
  return `${n.toLocaleString()}원`
}

function fmtNum(n: number) {
  if (!n) return '-'
  return n.toLocaleString()
}

function extractFiscalYear(note: string | null): number | null {
  const m = note?.match(/^(\d)연차/)
  return m ? Number(m[1]) : null
}

function extractYearRange(note: string | null): { start: string; end: string } | null {
  const m = note?.match(/\((\d{4}-\d{2})~(\d{4}-\d{2})\)/)
  if (!m) return null
  return { start: m[1] + '-01', end: m[2] + '-31' }
}

function buildYearRanges(items: BudgetItem[]): Map<number, { start: string; end: string }> {
  const map = new Map<number, { start: string; end: string }>()
  items.forEach(b => {
    const yr = extractFiscalYear(b.note)
    const range = extractYearRange(b.note)
    if (yr && range && !map.has(yr)) map.set(yr, range)
  })
  return map
}

function getExpenseYear(date: string, ranges: Map<number, { start: string; end: string }>): number | null {
  for (const [yr, { start, end }] of ranges) {
    if (date >= start && date <= end) return yr
  }
  return null
}

export default function BudgetPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all')
  const [activeTab, setActiveTab] = useState<'summary' | 'expense'>('summary')

  // 연차별 예산 편집
  const [showAnnualEditor, setShowAnnualEditor] = useState(false)
  const [annualForm, setAnnualForm] = useState<AnnualBudget>({ label: '', period: '', gov_cash: 0, org_cash: 0, org_kind: 0 })
  const [editAnnualIdx, setEditAnnualIdx] = useState<number | null>(null)

  // 비목 추가 폼
  const [showBudgetForm, setShowBudgetForm] = useState(false)
  const [editBudgetId, setEditBudgetId] = useState<string | null>(null)
  const [bf, setBf] = useState({ fiscal_year: 1, category: '현금 인건비', planned_amount: '', note: '' })

  // 집행 추가 폼
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [ef, setEf] = useState({
    category: '현금 인건비',
    expense_date: new Date().toISOString().slice(0, 10),
    description: '', vendor: '', amount: '',
  })

  useEffect(() => {
    supabase.from('projects').select('*').in('status', SELECTED_STATUSES).order('project_name')
      .then(({ data }) => {
        const list = data ?? []
        setProjects(list)
        if (list.length > 0) setSelectedId(list[0].id)
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    if (!selectedId) return
    setSelectedYear('all')
    Promise.all([
      supabase.from('budget_items').select('*').eq('project_id', selectedId).order('created_at'),
      supabase.from('expenses').select('*').eq('project_id', selectedId).order('expense_date', { ascending: false }),
    ]).then(([b, e]) => {
      setBudgetItems(b.data ?? [])
      setExpenses(e.data ?? [])
    })
  }, [selectedId])

  const selectedProject = projects.find(p => p.id === selectedId)
  const yearRanges = useMemo(() => buildYearRanges(budgetItems), [budgetItems])
  const availableYears = useMemo(() => Array.from(yearRanges.keys()).sort(), [yearRanges])

  const filteredBudgetItems = useMemo(() =>
    selectedYear === 'all' ? budgetItems : budgetItems.filter(b => extractFiscalYear(b.note) === selectedYear),
    [budgetItems, selectedYear])

  const filteredExpenses = useMemo(() =>
    selectedYear === 'all' ? expenses : expenses.filter(e => getExpenseYear(e.expense_date, yearRanges) === selectedYear),
    [expenses, selectedYear, yearRanges])

  // 비목별 집행 합산
  const executedByCategory = useMemo(() => {
    const map: Record<string, number> = {}
    filteredExpenses.forEach(e => { map[e.category] = (map[e.category] ?? 0) + e.amount })
    return map
  }, [filteredExpenses])

  // 전체 합계
  const totalPlanned = filteredBudgetItems.reduce((s, b) => s + b.planned_amount, 0)
  const totalExecuted = filteredExpenses.reduce((s, e) => s + e.amount, 0)
  const totalRemaining = totalPlanned - totalExecuted
  const totalRate = totalPlanned > 0 ? (totalExecuted / totalPlanned) * 100 : 0

  async function saveBudget() {
    if (!selectedId || !bf.planned_amount) return
    const range = yearRanges.get(bf.fiscal_year)
    const yearLabel = range
      ? `${bf.fiscal_year}연차 (${range.start.slice(0, 7)}~${range.end.slice(0, 7)})`
      : `${bf.fiscal_year}연차`
    const noteValue = bf.note ? `${yearLabel} - ${bf.note}` : yearLabel
    const data = { project_id: selectedId, category: bf.category, planned_amount: Number(bf.planned_amount), note: noteValue }
    if (editBudgetId) {
      await supabase.from('budget_items').update(data).eq('id', editBudgetId)
      setBudgetItems(prev => prev.map(b => b.id === editBudgetId ? { ...b, ...data } : b))
    } else {
      const { data: ins } = await supabase.from('budget_items').insert(data).select().single()
      if (ins) setBudgetItems(prev => [...prev, ins])
    }
    setShowBudgetForm(false)
    setBf({ fiscal_year: typeof selectedYear === 'number' ? selectedYear : 1, category: '현금 인건비', planned_amount: '', note: '' })
    setEditBudgetId(null)
  }

  async function deleteBudget(id: string) {
    await supabase.from('budget_items').delete().eq('id', id)
    setBudgetItems(prev => prev.filter(b => b.id !== id))
  }

  // 연차별 예산 저장
  async function saveAnnualBudget() {
    if (!selectedId || !annualForm.label) return
    const proj = projects.find(p => p.id === selectedId)
    const parsed = parseNotes(proj?.notes ?? null)
    const existing = parsed.annual_budgets ?? []
    let updated: AnnualBudget[]
    if (editAnnualIdx !== null) {
      updated = existing.map((ab, i) => i === editAnnualIdx ? annualForm : ab)
    } else {
      updated = [...existing, annualForm]
    }
    const newNotes = JSON.stringify({ ...parsed, annual_budgets: updated })
    await supabase.from('projects').update({ notes: newNotes }).eq('id', selectedId)
    setProjects(prev => prev.map(p => p.id === selectedId ? { ...p, notes: newNotes } : p))
    setShowAnnualEditor(false)
    setAnnualForm({ label: '', period: '', gov_cash: 0, org_cash: 0, org_kind: 0 })
    setEditAnnualIdx(null)
  }

  async function deleteAnnualBudget(idx: number) {
    const proj = projects.find(p => p.id === selectedId)
    const parsed = parseNotes(proj?.notes ?? null)
    const updated = (parsed.annual_budgets ?? []).filter((_, i) => i !== idx)
    const newNotes = JSON.stringify({ ...parsed, annual_budgets: updated })
    await supabase.from('projects').update({ notes: newNotes }).eq('id', selectedId)
    setProjects(prev => prev.map(p => p.id === selectedId ? { ...p, notes: newNotes } : p))
  }

  async function saveExpense() {
    if (!selectedId || !ef.description || !ef.amount) return
    const data = { project_id: selectedId, category: ef.category, expense_date: ef.expense_date, description: ef.description, vendor: ef.vendor || null, amount: Number(ef.amount) }
    const { data: ins } = await supabase.from('expenses').insert(data).select().single()
    if (ins) setExpenses(prev => [ins, ...prev])
    setShowExpenseForm(false)
    setEf({ category: '현금 인건비', expense_date: new Date().toISOString().slice(0, 10), description: '', vendor: '', amount: '' })
  }

  async function deleteExpense(id: string) {
    await supabase.from('expenses').delete().eq('id', id)
    setExpenses(prev => prev.filter(e => e.id !== id))
  }

  if (loading) return <div style={{ padding: 40, color: '#adbac9' }}>불러오는 중...</div>

  const yearLabel = (yr: number) => {
    const r = yearRanges.get(yr)
    return r ? `${yr}연차 (${r.start.slice(0, 7)} ~ ${r.end.slice(0, 7)})` : `${yr}연차`
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      <div className="page-header">
        <p style={{ fontSize: 12, color: '#adbac9', marginBottom: 4 }}>최종 선정 과제 · 연차별 사업비 관리</p>
        <h1 className="page-title" style={{ fontSize: 22, fontWeight: 700, color: '#1e2c33', letterSpacing: '-0.5px' }}>사업비 관리</h1>
      </div>

      <div className="page-body">
        {/* 과제 선택 + 연차 탭 */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
          <select
            value={selectedId ?? ''}
            onChange={e => { setSelectedId(e.target.value); setSelectedYear('all') }}
            className="project-select"
            style={{ maxWidth: 320 }}
          >
            {projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
          </select>
          {projects.length === 0 && <p style={{ fontSize: 13, color: '#adbac9' }}>최종 선정된 과제가 없습니다.</p>}

          {/* 연차 탭 */}
          {availableYears.length > 0 && (
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setSelectedYear('all')} style={{
                padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                border: selectedYear === 'all' ? 'none' : '1px solid #E8ECF0',
                backgroundColor: selectedYear === 'all' ? '#1e2c33' : '#fff',
                color: selectedYear === 'all' ? '#fff' : '#707d89',
              }}>전체</button>
              {availableYears.map(yr => (
                <button key={yr} onClick={() => setSelectedYear(yr)} style={{
                  padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  border: selectedYear === yr ? 'none' : '1px solid #E8ECF0',
                  backgroundColor: selectedYear === yr ? '#1e2c33' : '#fff',
                  color: selectedYear === yr ? '#fff' : '#707d89',
                }}>{yr}연차</button>
              ))}
            </div>
          )}
        </div>

        {selectedProject && (<>
          {/* ── 프로젝트 요약 헤더 ── */}
          <div style={{ backgroundColor: '#fff', borderRadius: 14, border: '1px solid #E8ECF0', padding: '16px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
            <div>
              <p style={{ fontSize: 11, color: '#adbac9', marginBottom: 2 }}>과제명</p>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#1e2c33' }}>{selectedProject.project_name}</p>
              {selectedProject.our_project_name && selectedProject.our_project_name !== selectedProject.project_name && (
                <p style={{ fontSize: 11, color: '#adbac9' }}>{selectedProject.our_project_name}</p>
              )}
            </div>
            <div style={{ width: 1, height: 36, backgroundColor: '#F0F3F6', flexShrink: 0 }} />
            {selectedProject.duration && (
              <div>
                <p style={{ fontSize: 11, color: '#adbac9', marginBottom: 2 }}>과제기간</p>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#384e5d' }}>{selectedProject.duration}</p>
              </div>
            )}
            {selectedProject.ministry && (
              <div>
                <p style={{ fontSize: 11, color: '#adbac9', marginBottom: 2 }}>전문기관</p>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#384e5d' }}>{selectedProject.ministry}</p>
              </div>
            )}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 20 }}>
              {[
                { label: '총 계획', value: fmtKRW(totalPlanned), color: '#1e2c33' },
                { label: '집행', value: fmtKRW(totalExecuted), color: '#2563EB' },
                { label: '잔액', value: fmtKRW(Math.abs(totalRemaining)), color: totalRemaining < 0 ? '#EF4444' : '#059669' },
                { label: '집행률', value: `${totalRate.toFixed(1)}%`, color: totalRate > 90 ? '#EF4444' : '#D97706' },
              ].map(s => (
                <div key={s.label} style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: 11, color: '#adbac9', marginBottom: 2 }}>{s.label}</p>
                  <p style={{ fontSize: 16, fontWeight: 800, color: s.color }}>{s.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── 연차별 예산 현황 테이블 ── */}
          {(() => {
            const parsed = parseNotes(selectedProject.notes)
            const annualBudgets = parsed.annual_budgets ?? []
            if (annualBudgets.length === 0 && !showAnnualEditor) return (
              <div style={{ marginBottom: 16, textAlign: 'right' }}>
                <button onClick={() => { setShowAnnualEditor(true); setEditAnnualIdx(null); setAnnualForm({ label: '', period: '', gov_cash: 0, org_cash: 0, org_kind: 0 }) }}
                  style={{ ...btnSecondaryStyle, fontSize: 11 }}>+ 연차별 예산 현황 추가</button>
              </div>
            )
            const totals = annualBudgets.reduce((acc, ab) => ({
              gov_cash: acc.gov_cash + ab.gov_cash,
              org_cash: acc.org_cash + ab.org_cash,
              org_kind: acc.org_kind + ab.org_kind,
            }), { gov_cash: 0, org_cash: 0, org_kind: 0 })

            return (
              <div style={{ backgroundColor: '#fff', borderRadius: 14, border: '1px solid #E8ECF0', overflow: 'hidden', marginBottom: 16 }}>
                {/* 테이블 헤더 */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #F0F3F6', backgroundColor: '#F9FAFB' }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#1e2c33' }}>연구개발비 현황</span>
                    <span style={{ fontSize: 11, color: '#adbac9', marginLeft: 6 }}>(단위: 천원)</span>
                  </div>
                  <button onClick={() => { setShowAnnualEditor(v => !v); setEditAnnualIdx(null); setAnnualForm({ label: '', period: '', gov_cash: 0, org_cash: 0, org_kind: 0 }) }}
                    style={{ ...btnSecondaryStyle, fontSize: 11, padding: '5px 12px' }}>+ 단계 추가</button>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ backgroundColor: '#F2F5FA' }}>
                        <th rowSpan={2} style={{ ...annualThStyle, borderRight: '1px solid #E8ECF0', minWidth: 70 }}></th>
                        <th style={{ ...annualThStyle, textAlign: 'center', borderBottom: '1px solid #E8ECF0' }}>정부지원<br/>연구개발비</th>
                        <th colSpan={3} style={{ ...annualThStyle, textAlign: 'center', borderLeft: '1px solid #E8ECF0', borderBottom: '1px solid #E8ECF0' }}>기관부담 연구개발비</th>
                        <th colSpan={3} style={{ ...annualThStyle, textAlign: 'center', borderLeft: '1px solid #E8ECF0', borderBottom: '1px solid #E8ECF0' }}>합계</th>
                        <th rowSpan={2} style={{ ...annualThStyle, width: 60 }}></th>
                      </tr>
                      <tr style={{ backgroundColor: '#F2F5FA' }}>
                        <th style={{ ...annualThStyle, textAlign: 'right', borderBottom: '2px solid #E8ECF0' }}>현금<br/>(A)</th>
                        <th style={{ ...annualThStyle, textAlign: 'right', borderLeft: '1px solid #E8ECF0', borderBottom: '2px solid #E8ECF0' }}>현금<br/>(B)</th>
                        <th style={{ ...annualThStyle, textAlign: 'right', borderBottom: '2px solid #E8ECF0' }}>현물<br/>(C)</th>
                        <th style={{ ...annualThStyle, textAlign: 'right', borderBottom: '2px solid #E8ECF0', color: '#707d89' }}>소계<br/>(B+C)</th>
                        <th style={{ ...annualThStyle, textAlign: 'right', borderLeft: '1px solid #E8ECF0', borderBottom: '2px solid #E8ECF0' }}>현금<br/>(A+B)</th>
                        <th style={{ ...annualThStyle, textAlign: 'right', borderBottom: '2px solid #E8ECF0' }}>현물<br/>(C)</th>
                        <th style={{ ...annualThStyle, textAlign: 'right', borderBottom: '2px solid #E8ECF0', fontWeight: 800 }}>합계<br/>(A+B+C)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* 총계 행 */}
                      <tr style={{ backgroundColor: '#EFF6FF', borderBottom: '2px solid #BFDBFE' }}>
                        <td style={{ ...annualTdStyle, fontWeight: 700, color: '#1e2c33', borderRight: '1px solid #E8ECF0' }}>총계</td>
                        <td style={{ ...annualTdStyle, textAlign: 'right', fontWeight: 700, color: '#2563EB' }}>{totals.gov_cash.toLocaleString()}</td>
                        <td style={{ ...annualTdStyle, textAlign: 'right', fontWeight: 700, color: '#2563EB', borderLeft: '1px solid #BFDBFE' }}>{totals.org_cash.toLocaleString()}</td>
                        <td style={{ ...annualTdStyle, textAlign: 'right', fontWeight: 700, color: '#2563EB' }}>{totals.org_kind.toLocaleString()}</td>
                        <td style={{ ...annualTdStyle, textAlign: 'right', fontWeight: 700, color: '#2563EB' }}>{(totals.org_cash + totals.org_kind).toLocaleString()}</td>
                        <td style={{ ...annualTdStyle, textAlign: 'right', fontWeight: 700, color: '#2563EB', borderLeft: '1px solid #BFDBFE' }}>{(totals.gov_cash + totals.org_cash).toLocaleString()}</td>
                        <td style={{ ...annualTdStyle, textAlign: 'right', fontWeight: 700, color: '#2563EB' }}>{totals.org_kind.toLocaleString()}</td>
                        <td style={{ ...annualTdStyle, textAlign: 'right', fontWeight: 800, color: '#1e2c33' }}>{(totals.gov_cash + totals.org_cash + totals.org_kind).toLocaleString()}</td>
                        <td style={{ ...annualTdStyle }}></td>
                      </tr>
                      {/* 단계별 행 */}
                      {annualBudgets.map((ab, idx) => {
                        const subtotal = ab.org_cash + ab.org_kind
                        const totalCash = ab.gov_cash + ab.org_cash
                        const total = ab.gov_cash + ab.org_cash + ab.org_kind
                        const isFirst = idx === 0
                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid #F0F3F6', backgroundColor: isFirst ? '#F0F9FF' : undefined }}
                            onMouseEnter={ev => (ev.currentTarget as HTMLElement).style.backgroundColor = '#F9FAFB'}
                            onMouseLeave={ev => (ev.currentTarget as HTMLElement).style.backgroundColor = isFirst ? '#F0F9FF' : ''}>
                            <td style={{ ...annualTdStyle, fontWeight: isFirst ? 700 : 500, color: isFirst ? '#2563EB' : '#384e5d', borderRight: '1px solid #F0F3F6' }}>
                              <div>{ab.label}</div>
                              {ab.period && <div style={{ fontSize: 10, color: '#adbac9', fontWeight: 400 }}>{ab.period}</div>}
                            </td>
                            <td style={{ ...annualTdStyle, textAlign: 'right', fontWeight: isFirst ? 700 : 400, color: isFirst ? '#2563EB' : '#1e2c33' }}>{ab.gov_cash.toLocaleString()}</td>
                            <td style={{ ...annualTdStyle, textAlign: 'right', color: '#384e5d', borderLeft: '1px solid #F0F3F6' }}>{ab.org_cash.toLocaleString()}</td>
                            <td style={{ ...annualTdStyle, textAlign: 'right', color: '#384e5d' }}>{ab.org_kind.toLocaleString()}</td>
                            <td style={{ ...annualTdStyle, textAlign: 'right', color: '#707d89' }}>{subtotal.toLocaleString()}</td>
                            <td style={{ ...annualTdStyle, textAlign: 'right', color: '#384e5d', borderLeft: '1px solid #F0F3F6' }}>{totalCash.toLocaleString()}</td>
                            <td style={{ ...annualTdStyle, textAlign: 'right', color: '#384e5d' }}>{ab.org_kind.toLocaleString()}</td>
                            <td style={{ ...annualTdStyle, textAlign: 'right', fontWeight: 700, color: '#1e2c33' }}>{total.toLocaleString()}</td>
                            <td style={{ ...annualTdStyle, textAlign: 'center' }}>
                              <button onClick={() => { setEditAnnualIdx(idx); setAnnualForm(ab); setShowAnnualEditor(true) }}
                                style={{ color: '#adbac9', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, marginRight: 4 }}>✎</button>
                              <button onClick={() => deleteAnnualBudget(idx)}
                                style={{ color: '#FCA5A5', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}>✕</button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* 단계 추가/편집 폼 */}
                {showAnnualEditor && (
                  <div style={{ padding: '14px 16px', borderTop: '1px solid #F0F3F6', backgroundColor: '#F9FAFB' }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: '#384e5d', marginBottom: 10 }}>
                      {editAnnualIdx !== null ? '단계 편집' : '새 단계 추가'}
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
                      <input placeholder="단계명 (예: 1단계)" value={annualForm.label}
                        onChange={e => setAnnualForm(p => ({ ...p, label: e.target.value }))} style={inputStyle} />
                      <input placeholder="기간 (예: 2024-11~2024-12)" value={annualForm.period}
                        onChange={e => setAnnualForm(p => ({ ...p, period: e.target.value }))} style={inputStyle} />
                      <input type="number" placeholder="정부지원 현금 A (천원)" value={annualForm.gov_cash || ''}
                        onChange={e => setAnnualForm(p => ({ ...p, gov_cash: Number(e.target.value) }))} style={inputStyle} />
                      <input type="number" placeholder="기관부담 현금 B (천원)" value={annualForm.org_cash || ''}
                        onChange={e => setAnnualForm(p => ({ ...p, org_cash: Number(e.target.value) }))} style={inputStyle} />
                      <input type="number" placeholder="기관부담 현물 C (천원)" value={annualForm.org_kind || ''}
                        onChange={e => setAnnualForm(p => ({ ...p, org_kind: Number(e.target.value) }))} style={inputStyle} />
                    </div>
                    {annualForm.gov_cash > 0 && (
                      <p style={{ fontSize: 11, color: '#707d89', marginBottom: 8 }}>
                        합계: {(annualForm.gov_cash + annualForm.org_cash + annualForm.org_kind).toLocaleString()}천원
                        ({((annualForm.gov_cash + annualForm.org_cash + annualForm.org_kind) / 10).toLocaleString()}만원)
                      </p>
                    )}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={saveAnnualBudget} style={btnPrimaryStyle}>저장</button>
                      <button onClick={() => setShowAnnualEditor(false)} style={btnSecondaryStyle}>취소</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })()}

          {/* ── 탭 + 액션 버튼 ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            {[{ key: 'summary', label: '비목별 현황' }, { key: 'expense', label: '집행내역' }].map(t => (
              <button key={t.key} onClick={() => setActiveTab(t.key as 'summary' | 'expense')}
                style={{ padding: '8px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: activeTab === t.key ? 'none' : '1px solid #E8ECF0', backgroundColor: activeTab === t.key ? '#1e2c33' : '#fff', color: activeTab === t.key ? '#fff' : '#707d89' }}>
                {t.label}
              </button>
            ))}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button onClick={() => { setEditBudgetId(null); setBf({ fiscal_year: typeof selectedYear === 'number' ? selectedYear : 1, category: '현금 인건비', planned_amount: '', note: '' }); setShowBudgetForm(v => !v) }}
                style={btnSecondaryStyle}>+ 비목 추가</button>
              <button onClick={() => setShowExpenseForm(v => !v)} style={btnPrimaryStyle}>+ 집행 추가</button>
            </div>
          </div>

          {/* 비목 추가 폼 */}
          {showBudgetForm && (
            <div style={{ backgroundColor: '#F9FAFB', border: '1px solid #E8ECF0', borderRadius: 12, padding: '14px 18px', marginBottom: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                <select value={bf.fiscal_year} onChange={e => setBf(p => ({ ...p, fiscal_year: Number(e.target.value) }))} style={inputStyle}>
                  {[1, 2, 3, 4].map(y => <option key={y} value={y}>{y}연차</option>)}
                </select>
                <select value={bf.category} onChange={e => setBf(p => ({ ...p, category: e.target.value }))} style={inputStyle}>
                  {BUDGET_CATEGORIES.map(g => (
                    <optgroup key={g.group} label={g.group}>
                      {g.items.map(i => <option key={i}>{i}</option>)}
                    </optgroup>
                  ))}
                </select>
                <input type="number" placeholder="계획액 (원)" value={bf.planned_amount} onChange={e => setBf(p => ({ ...p, planned_amount: e.target.value }))} style={inputStyle} />
                <input placeholder="메모 (선택)" value={bf.note} onChange={e => setBf(p => ({ ...p, note: e.target.value }))} style={inputStyle} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={saveBudget} style={btnPrimaryStyle}>저장</button>
                <button onClick={() => setShowBudgetForm(false)} style={btnSecondaryStyle}>취소</button>
              </div>
            </div>
          )}

          {/* 집행 추가 폼 */}
          {showExpenseForm && (
            <div style={{ backgroundColor: '#F9FAFB', border: '1px solid #E8ECF0', borderRadius: 12, padding: '14px 18px', marginBottom: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                <select value={ef.category} onChange={e => setEf(p => ({ ...p, category: e.target.value }))} style={inputStyle}>
                  {BUDGET_CATEGORIES.map(g => (
                    <optgroup key={g.group} label={g.group}>
                      {g.items.map(i => <option key={i}>{i}</option>)}
                    </optgroup>
                  ))}
                </select>
                <input type="date" value={ef.expense_date} onChange={e => setEf(p => ({ ...p, expense_date: e.target.value }))} style={inputStyle} />
                <input placeholder="내용 *" value={ef.description} onChange={e => setEf(p => ({ ...p, description: e.target.value }))} style={inputStyle} />
                <input placeholder="거래처" value={ef.vendor} onChange={e => setEf(p => ({ ...p, vendor: e.target.value }))} style={inputStyle} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: 10, marginBottom: 10 }}>
                <input type="number" placeholder="금액 (원) *" value={ef.amount} onChange={e => setEf(p => ({ ...p, amount: e.target.value }))} style={inputStyle} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={saveExpense} style={btnPrimaryStyle}>저장</button>
                <button onClick={() => setShowExpenseForm(false)} style={btnSecondaryStyle}>취소</button>
              </div>
            </div>
          )}

          {activeTab === 'summary' ? (
            /* ── 비목별 현황 테이블 (스크린샷 스타일) ── */
            <div style={{ backgroundColor: '#fff', borderRadius: 14, border: '1px solid #E8ECF0', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ backgroundColor: '#F2F5FA' }}>
                    <th style={thStyle}>구분</th>
                    <th style={thStyle}>비목</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>계획</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>집행</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>잔액</th>
                    <th style={{ ...thStyle, textAlign: 'center', minWidth: 100 }}>집행률</th>
                    <th style={{ ...thStyle, width: 60 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {BUDGET_CATEGORIES.map(g => {
                    const groupItems = filteredBudgetItems.filter(b => g.items.includes(b.category))
                    if (groupItems.length === 0) return null

                    const groupPlanned = groupItems.reduce((s, b) => s + b.planned_amount, 0)
                    const groupExecuted = groupItems.reduce((s, b) => s + (executedByCategory[b.category] ?? 0), 0)
                    const groupRate = groupPlanned > 0 ? (groupExecuted / groupPlanned) * 100 : 0
                    const color = GROUP_COLORS[g.group]

                    return groupItems.map((b, idx) => {
                      const executed = executedByCategory[b.category] ?? 0
                      const remaining = b.planned_amount - executed
                      const rate = b.planned_amount > 0 ? (executed / b.planned_amount) * 100 : 0
                      const isFirst = idx === 0
                      const isLast = idx === groupItems.length - 1

                      return (
                        <tr key={b.id} style={{ borderTop: '1px solid #F0F3F6' }}
                          onMouseEnter={ev => (ev.currentTarget as HTMLElement).style.backgroundColor = '#FAFBFC'}
                          onMouseLeave={ev => (ev.currentTarget as HTMLElement).style.backgroundColor = ''}>
                          {/* 구분 (대분류) - rowspan 효과 */}
                          {isFirst && (
                            <td rowSpan={groupItems.length} style={{
                              padding: '0 16px',
                              verticalAlign: 'middle',
                              borderRight: '2px solid #F0F3F6',
                              whiteSpace: 'nowrap',
                            }}>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                                <span style={{
                                  fontSize: 11, fontWeight: 700, color, padding: '4px 10px',
                                  backgroundColor: color + '15', borderRadius: 6, whiteSpace: 'nowrap'
                                }}>{g.group}</span>
                                {groupItems.length > 1 && (
                                  <span style={{ fontSize: 10, color: '#adbac9' }}>
                                    {fmtKRW(groupPlanned)}
                                  </span>
                                )}
                              </div>
                            </td>
                          )}
                          {/* 비목 */}
                          <td style={{ padding: '13px 16px', color: '#384e5d', fontWeight: 500 }}>{b.category}</td>
                          {/* 계획 */}
                          <td style={{ padding: '13px 16px', textAlign: 'right', color: '#1e2c33', fontWeight: 600 }}>
                            {fmtNum(b.planned_amount)}
                          </td>
                          {/* 집행 */}
                          <td style={{ padding: '13px 16px', textAlign: 'right', color: executed > 0 ? '#2563EB' : '#ced7df', fontWeight: executed > 0 ? 600 : 400 }}>
                            {executed > 0 ? fmtNum(executed) : '-'}
                          </td>
                          {/* 잔액 */}
                          <td style={{ padding: '13px 16px', textAlign: 'right', color: remaining < 0 ? '#EF4444' : '#059669', fontWeight: 600 }}>
                            {remaining < 0 ? '▲ ' : ''}{fmtNum(Math.abs(remaining))}
                          </td>
                          {/* 집행률 바 */}
                          <td style={{ padding: '13px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ flex: 1, height: 6, backgroundColor: '#F0F3F6', borderRadius: 3, overflow: 'hidden', minWidth: 60 }}>
                                <div style={{ width: `${Math.min(rate, 100)}%`, height: '100%', borderRadius: 3, backgroundColor: rate > 90 ? '#EF4444' : color }} />
                              </div>
                              <span style={{ fontSize: 12, fontWeight: 700, color: rate > 90 ? '#EF4444' : '#707d89', minWidth: 36, textAlign: 'right' }}>
                                {rate.toFixed(1)}%
                              </span>
                            </div>
                          </td>
                          {/* 액션 */}
                          <td style={{ padding: '13px 12px', textAlign: 'center' }}>
                            <button onClick={() => {
                              const yr = extractFiscalYear(b.note) ?? 1
                              const raw = b.note?.replace(/^\d연차(\s*\([^)]+\))?(\s*-\s*)?/, '').trim() ?? ''
                              setEditBudgetId(b.id); setBf({ fiscal_year: yr, category: b.category, planned_amount: String(b.planned_amount), note: raw }); setShowBudgetForm(true)
                            }} style={{ color: '#adbac9', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, marginRight: 4 }}>✎</button>
                            <button onClick={() => deleteBudget(b.id)} style={{ color: '#FCA5A5', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }}>✕</button>
                          </td>
                        </tr>
                      )
                    })
                  })}

                  {/* 합계 행 */}
                  {filteredBudgetItems.length > 0 && (
                    <tr style={{ borderTop: '2px solid #E8ECF0', backgroundColor: '#F9FAFB' }}>
                      <td colSpan={2} style={{ padding: '13px 16px', fontWeight: 700, color: '#1e2c33', fontSize: 13 }}>합계</td>
                      <td style={{ padding: '13px 16px', textAlign: 'right', fontWeight: 700, color: '#1e2c33' }}>{fmtNum(totalPlanned)}</td>
                      <td style={{ padding: '13px 16px', textAlign: 'right', fontWeight: 700, color: '#2563EB' }}>{totalExecuted > 0 ? fmtNum(totalExecuted) : '-'}</td>
                      <td style={{ padding: '13px 16px', textAlign: 'right', fontWeight: 700, color: totalRemaining < 0 ? '#EF4444' : '#059669' }}>
                        {totalRemaining < 0 ? '▲ ' : ''}{fmtNum(Math.abs(totalRemaining))}
                      </td>
                      <td style={{ padding: '13px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, height: 6, backgroundColor: '#E8ECF0', borderRadius: 3, overflow: 'hidden', minWidth: 60 }}>
                            <div style={{ width: `${Math.min(totalRate, 100)}%`, height: '100%', borderRadius: 3, backgroundColor: totalRate > 90 ? '#EF4444' : '#1e2c33' }} />
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 800, color: totalRate > 90 ? '#EF4444' : '#1e2c33', minWidth: 36, textAlign: 'right' }}>
                            {totalRate.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td />
                    </tr>
                  )}

                  {filteredBudgetItems.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#adbac9', fontSize: 13 }}>
                        비목이 없습니다. + 비목 추가를 눌러 추가하세요.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            /* ── 집행내역 테이블 ── */
            <div style={{ backgroundColor: '#fff', borderRadius: 14, border: '1px solid #E8ECF0', overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid #F0F3F6', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#1e2c33' }}>집행내역</span>
                <span style={{ fontSize: 12, color: '#adbac9' }}>총 {filteredExpenses.length}건</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#2563EB', marginLeft: 4 }}>{fmtKRW(totalExecuted)}</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#F2F5FA' }}>
                      {['연차', '날짜', '비목', '내용', '거래처', '금액', ''].map(h => (
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExpenses.length === 0 ? (
                      <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#adbac9' }}>집행내역이 없습니다</td></tr>
                    ) : filteredExpenses.map(e => {
                      const color = GROUP_COLORS[getGroup(e.category)]
                      const expYr = getExpenseYear(e.expense_date, yearRanges)
                      return (
                        <tr key={e.id} style={{ borderTop: '1px solid #F0F3F6' }}
                          onMouseEnter={ev => (ev.currentTarget as HTMLElement).style.backgroundColor = '#FAFBFC'}
                          onMouseLeave={ev => (ev.currentTarget as HTMLElement).style.backgroundColor = ''}>
                          <td style={{ padding: '11px 14px' }}>
                            {expYr ? <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, backgroundColor: '#F2F5FA', color: '#384e5d', fontWeight: 600 }}>{expYr}연차</span> : <span style={{ color: '#ced7df' }}>-</span>}
                          </td>
                          <td style={{ padding: '11px 14px', color: '#707d89', whiteSpace: 'nowrap' }}>{e.expense_date}</td>
                          <td style={{ padding: '11px 14px' }}>
                            <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, backgroundColor: color + '15', color, fontWeight: 600, whiteSpace: 'nowrap' }}>{e.category}</span>
                          </td>
                          <td style={{ padding: '11px 14px', color: '#1e2c33', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.description}</td>
                          <td style={{ padding: '11px 14px', color: '#707d89', whiteSpace: 'nowrap' }}>{e.vendor ?? '-'}</td>
                          <td style={{ padding: '11px 14px', fontWeight: 700, color: '#1e2c33', whiteSpace: 'nowrap', textAlign: 'right' }}>{e.amount.toLocaleString()}</td>
                          <td style={{ padding: '11px 12px', textAlign: 'center' }}>
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

const thStyle: React.CSSProperties = {
  textAlign: 'left', padding: '10px 16px', fontWeight: 600,
  color: '#707d89', fontSize: 12, whiteSpace: 'nowrap', letterSpacing: '0.2px',
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
const annualThStyle: React.CSSProperties = {
  padding: '8px 12px', fontWeight: 600, color: '#707d89', fontSize: 11,
  whiteSpace: 'nowrap', letterSpacing: '0.2px',
}
const annualTdStyle: React.CSSProperties = {
  padding: '10px 12px', fontSize: 12, color: '#384e5d', whiteSpace: 'nowrap',
}
