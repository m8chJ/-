'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Project } from '@/types/project'
import ProjectGrouped from '@/components/ProjectGrouped'

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchProjects() }, [])

  async function fetchProjects() {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('application_end', { ascending: true, nullsFirst: false })
    if (!error && data) setProjects(data)
    setLoading(false)
  }

  async function handleStatusChange(id: string, status: string) {
    await supabase.from('projects').update({ status }).eq('id', id)
    setProjects(prev => prev.map(p => p.id === id ? { ...p, status } : p))
  }

  async function handleAdd(data: Partial<Project>) {
    const { data: inserted, error } = await supabase.from('projects').insert(data).select().single()
    if (!error && inserted) setProjects(prev => [inserted, ...prev])
  }

  async function handleUpdate(id: string, data: Partial<Project>) {
    await supabase.from('projects').update(data).eq('id', id)
    setProjects(prev => prev.map(p => p.id === id ? { ...p, ...data } : p))
  }

  async function handleDelete(id: string) {
    await supabase.from('projects').delete().eq('id', id)
    setProjects(prev => prev.filter(p => p.id !== id))
  }

  // 요약 통계
  const matchStatus = (p: Project, ...targets: string[]) =>
    targets.some(t => p.status === t || p.status?.replace(/\s/g, '') === t.replace(/\s/g, ''))

  const stats = [
    { label: '최종 선정', count: projects.filter(p => matchStatus(p, '최종 선정', '최종선정')).length, color: 'text-green-600 bg-green-50' },
    { label: '서류 통과', count: projects.filter(p => matchStatus(p, '서류 통과', '서류통과')).length, color: 'text-blue-600 bg-blue-50' },
    { label: '제출 완료', count: projects.filter(p => matchStatus(p, '제출 완료', '지원완료')).length, color: 'text-indigo-600 bg-indigo-50' },
    { label: '지원 예정', count: projects.filter(p => matchStatus(p, '지원예정')).length, color: 'text-yellow-600 bg-yellow-50' },
  ]

  const totalFunding = projects
    .filter(p => matchStatus(p, '최종 선정', '최종선정'))
    .reduce((sum, p) => sum + (p.budget_total ?? 0), 0)

  return (
    <div className="min-h-screen bg-gray-50">
      <header style={{ backgroundColor: '#1e2c33' }}>
        <div className="max-w-7xl mx-auto px-6 py-4">
          <h1 className="text-xl font-bold text-white">정부지원사업 관리 시스템</h1>
          <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.8)' }}>공고 현황 및 진행 상태 관리</p>
          <div className="flex gap-2 mt-3">
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-white text-[#1e2c33]">공고 관리</span>
            <Link href="/recommend" className="px-3 py-1 rounded-full text-xs font-medium border border-white/30 text-white/70 hover:bg-white/10 transition-colors">
              공고 추천 ✨
            </Link>
          </div>
        </div>
      </header>

      {/* 가용 지원금 배너 */}
      <div style={{ backgroundColor: '#384e5d' }}>
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-4">
          <span className="text-white text-sm">현재 가용 지원금 (최종 선정 기준)</span>
          <span className="text-white font-bold text-xl">{totalFunding.toFixed(2)}억원</span>
          <span className="text-white opacity-50 text-xs ml-auto">선정 과제 {projects.filter(p => matchStatus(p, '최종 선정', '최종선정')).length}건</span>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 py-6">
        {/* 요약 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {stats.map((s) => (
            <div key={s.label} className={`rounded-xl p-4 ${s.color}`}>
              <p className="text-2xl font-bold">{s.count}</p>
              <p className="text-sm font-medium mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400">불러오는 중...</div>
        ) : (
          <ProjectGrouped
            projects={projects}
            onStatusChange={handleStatusChange}
            onAdd={handleAdd}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
          />
        )}
      </main>
    </div>
  )
}
