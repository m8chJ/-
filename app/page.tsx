'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Project } from '@/types/project'
import ProjectTable from '@/components/ProjectTable'

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchProjects()
  }, [])

  async function fetchProjects() {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('application_end', { ascending: true, nullsFirst: false })

    if (!error && data) {
      setProjects(data)
    }
    setLoading(false)
  }

  async function handleStatusChange(id: string, status: string) {
    await supabase.from('projects').update({ status }).eq('id', id)
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)))
  }

  // 요약 통계
  const matchStatus = (p: Project, ...targets: string[]) =>
    targets.some(t => p.status === t || p.status?.replace(/\s/g, '') === t.replace(/\s/g, ''))

  const stats = [
    { label: '최종 선정', count: projects.filter(p => matchStatus(p, '최종 선정', '최종선정')).length, color: 'text-green-600 bg-green-50' },
    { label: '서류 통과', count: projects.filter(p => matchStatus(p, '서류 통과', '서류통과')).length, color: 'text-blue-600 bg-blue-50' },
    { label: '제출 완료', count: projects.filter(p => matchStatus(p, '제출 완료', '지원완료')).length, color: 'text-indigo-600 bg-indigo-50' },
    { label: '지원 예정', count: projects.filter(p => matchStatus(p, '지원예정', '공고 예정', '공고예정')).length, color: 'text-yellow-600 bg-yellow-50' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header style={{ backgroundColor: '#7ccbd2' }}>
        <div className="max-w-7xl mx-auto px-6 py-4">
          <h1 className="text-xl font-bold text-white">정부지원사업 관리 시스템</h1>
          <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.8)' }}>공고 현황 및 진행 상태 관리</p>
        </div>
      </header>

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

        {/* 공고 테이블 */}
        {loading ? (
          <div className="text-center py-20 text-gray-400">불러오는 중...</div>
        ) : (
          <ProjectTable projects={projects} onStatusChange={handleStatusChange} />
        )}
      </main>
    </div>
  )
}
