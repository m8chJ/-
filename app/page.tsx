'use client'

import { useEffect, useState } from 'react'
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

  const matchStatus = (p: Project, ...targets: string[]) =>
    targets.some(t => p.status === t || p.status?.replace(/\s/g, '') === t.replace(/\s/g, ''))

  const finalSelected = projects.filter(p => matchStatus(p, '최종 선정', '최종선정'))
  const docPassed = projects.filter(p => matchStatus(p, '서류 통과', '서류통과'))
  const submitted = projects.filter(p => matchStatus(p, '제출 완료', '지원완료'))
  const planned = projects.filter(p => matchStatus(p, '지원예정'))
  const totalFunding = finalSelected.reduce((sum, p) => sum + (p.budget_total ?? 0), 0)
  const activeCount = projects.filter(p => !matchStatus(p, '미선정', '지원취소', '지원불가')).length

  const stats = [
    {
      label: '최종 선정',
      count: finalSelected.length,
      sub: `${totalFunding > 0 ? totalFunding.toFixed(1) + '억' : '-'}`,
      color: '#12B76A',
      bg: '#ECFDF3',
      icon: (
        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#12B76A" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: '서류 통과',
      count: docPassed.length,
      sub: '심사 진행 중',
      color: '#2563EB',
      bg: '#EFF6FF',
      icon: (
        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#2563EB" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
      ),
    },
    {
      label: '제출 완료',
      count: submitted.length,
      sub: '결과 대기 중',
      color: '#7C3AED',
      bg: '#F5F3FF',
      icon: (
        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#7C3AED" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
        </svg>
      ),
    },
    {
      label: '지원 예정',
      count: planned.length,
      sub: '준비 중',
      color: '#D97706',
      bg: '#FFFBEB',
      icon: (
        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#D97706" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  ]

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* 페이지 헤더 */}
      <div style={{ padding: '28px 32px 0' }}>
        <p style={{ fontSize: 12, color: '#adbac9', marginBottom: 4 }}>안녕하세요, 핏투게더 팀</p>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1e2c33', letterSpacing: '-0.5px' }}>
          정부지원사업 대시보드
        </h1>
      </div>

      <div style={{ padding: '20px 32px 32px' }}>
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
          }}
        >
          {/* 배경 장식 */}
          <div style={{
            position: 'absolute', right: -20, top: -20,
            width: 200, height: 200,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.04)',
          }} />
          <div style={{
            position: 'absolute', right: 60, bottom: -40,
            width: 150, height: 150,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.03)',
          }} />

          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 10 }}>
            (주)핏투게더 · 현재 관리중인 정부사업
          </p>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 8 }}>
            <div>
              <span style={{ fontSize: 42, fontWeight: 800, color: '#ffffff', letterSpacing: '-1px' }}>
                {activeCount}
              </span>
              <span style={{ fontSize: 18, color: 'rgba(255,255,255,0.7)', marginLeft: 4 }}>건</span>
            </div>
            {totalFunding > 0 && (
              <>
                <div style={{ width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.2)' }} />
                <div>
                  <span style={{ fontSize: 42, fontWeight: 800, color: '#ffffff', letterSpacing: '-1px' }}>
                    {totalFunding.toFixed(1)}
                  </span>
                  <span style={{ fontSize: 18, color: 'rgba(255,255,255,0.7)', marginLeft: 4 }}>억원 확정</span>
                </div>
              </>
            )}
          </div>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>
            최종 선정 {finalSelected.length}건 포함 · 전체 {projects.length}건 등록
          </p>
        </div>

        {/* 통계 카드 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
          {stats.map(s => (
            <div
              key={s.label}
              style={{
                backgroundColor: '#ffffff',
                borderRadius: 14,
                padding: '20px 22px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <p style={{ fontSize: 12, color: '#adbac9', marginBottom: 8, fontWeight: 500 }}>{s.label}</p>
                <p style={{ fontSize: 28, fontWeight: 800, color: '#1e2c33', letterSpacing: '-0.5px', lineHeight: 1 }}>
                  {s.count}
                  <span style={{ fontSize: 14, fontWeight: 500, color: '#adbac9', marginLeft: 2 }}>건</span>
                </p>
                <p style={{ fontSize: 11, color: s.color, marginTop: 6, fontWeight: 500 }}>{s.sub}</p>
              </div>
              <div style={{
                width: 40, height: 40,
                borderRadius: 10,
                backgroundColor: s.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {s.icon}
              </div>
            </div>
          ))}
        </div>

        {/* 공고 목록 섹션 */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 16,
            boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)',
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #F0F3F6' }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1e2c33' }}>공고 현황</h2>
            <p style={{ fontSize: 13, color: '#adbac9', marginTop: 2 }}>상태별 공고를 확인하고 관리하세요</p>
          </div>
          <div style={{ padding: '20px 24px' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: '#adbac9', fontSize: 14 }}>
                불러오는 중...
              </div>
            ) : (
              <ProjectGrouped
                projects={projects}
                onStatusChange={handleStatusChange}
                onAdd={handleAdd}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
