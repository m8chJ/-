'use client'

import { useState, useMemo } from 'react'
import { Project, STATUS_LIST, STATUS_COLORS } from '@/types/project'
import StatusBadge from './StatusBadge'
import ProjectDetailModal from './ProjectDetailModal'
import AddEditProjectModal from './AddEditProjectModal'

type Props = {
  projects: Project[]
  onStatusChange: (id: string, status: string) => void
  onAdd: (data: Partial<Project>) => void
  onUpdate: (id: string, data: Partial<Project>) => void
  onDelete: (id: string) => void
}

function getDday(dateStr: string | null): { label: string; color: string } | null {
  if (!dateStr) return null
  const end = new Date(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  end.setHours(0, 0, 0, 0)
  const diff = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (diff < 0) return { label: '마감', color: '#adbac9' }
  if (diff === 0) return { label: 'D-Day', color: '#EF4444' }
  if (diff <= 7) return { label: `D-${diff}`, color: '#EF4444' }
  if (diff <= 14) return { label: `D-${diff}`, color: '#F97316' }
  return { label: `D-${diff}`, color: '#adbac9' }
}

const STATUS_ORDER = [
  '최종 선정', '최종선정',
  '서류 통과', '서류통과',
  '제출 완료', '지원완료',
  '지원예정',
  '공고 예정', '공고예정',
  '검토중',
  '미선정',
  '지원불가',
]

function normalizeStatus(s: string | null) {
  return s?.replace(/\s/g, '') ?? '검토중'
}

export default function ProjectGrouped({ projects, onStatusChange, onAdd, onUpdate, onDelete }: Props) {
  const [search, setSearch] = useState('')
  const [managerFilter, setManagerFilter] = useState('전체')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    '미선정': true,
    '지원불가': true,
  })
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)

  const managers = useMemo(() => {
    const set = new Set<string>()
    projects.forEach(p => {
      if (p.manager) set.add(p.manager)
      if (p.writer) set.add(p.writer)
    })
    return ['전체', ...Array.from(set).sort()]
  }, [projects])

  const filtered = useMemo(() => projects.filter(p => {
    const matchSearch = search === '' ||
      p.project_name.includes(search) ||
      (p.ministry ?? '').includes(search) ||
      (p.manager ?? '').includes(search) ||
      (p.writer ?? '').includes(search)
    const matchManager = managerFilter === '전체' ||
      p.manager === managerFilter || p.writer === managerFilter
    return matchSearch && matchManager
  }), [projects, search, managerFilter])

  // 상태별 그룹핑
  const grouped = useMemo(() => {
    const map = new Map<string, Project[]>()
    const displayStatus: Record<string, string> = {}

    filtered.forEach(p => {
      const norm = normalizeStatus(p.status)
      // 표시용 상태명 찾기
      const display = STATUS_LIST.find(s => s !== '전체' && s.replace(/\s/g, '') === norm) ?? (p.status ?? '검토중')
      displayStatus[norm] = display
      if (!map.has(display)) map.set(display, [])
      map.get(display)!.push(p)
    })

    // 순서 정렬
    const ordered: { status: string; items: Project[] }[] = []
    const seen = new Set<string>()

    STATUS_ORDER.forEach(s => {
      const norm = s.replace(/\s/g, '')
      const display = STATUS_LIST.find(sl => sl !== '전체' && sl.replace(/\s/g, '') === norm) ?? s
      if (!seen.has(display) && map.has(display)) {
        ordered.push({ status: display, items: map.get(display)! })
        seen.add(display)
      }
    })

    // 나머지 상태
    map.forEach((items, status) => {
      if (!seen.has(status)) ordered.push({ status, items })
    })

    return ordered
  }, [filtered])

  function toggleCollapse(status: string) {
    setCollapsed(prev => ({ ...prev, [status]: !prev[status] }))
  }

  return (
    <div>
      {/* 검색 + 필터 + 추가 버튼 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20, alignItems: 'center' }}>
        <input
          type="text"
          placeholder="사업명, 부처, 담당자로 검색..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            padding: '9px 14px',
            border: '1px solid #E8ECF0',
            borderRadius: 10,
            fontSize: 13,
            outline: 'none',
            width: 220,
            color: '#1e2c33',
            fontFamily: 'inherit',
          }}
        />
        <select
          value={managerFilter}
          onChange={e => setManagerFilter(e.target.value)}
          style={{
            padding: '9px 14px',
            border: '1px solid #E8ECF0',
            borderRadius: 10,
            fontSize: 13,
            outline: 'none',
            color: '#707d89',
            fontFamily: 'inherit',
            backgroundColor: '#ffffff',
          }}
        >
          {managers.map(m => <option key={m}>{m}</option>)}
        </select>
        <div style={{ marginLeft: 'auto' }}>
          <button
            onClick={() => setShowAddModal(true)}
            style={{
              padding: '9px 18px',
              borderRadius: 10,
              backgroundColor: '#1e2c33',
              color: '#ffffff',
              fontSize: 13,
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            + 공고 추가
          </button>
        </div>
      </div>

      {/* 상태별 섹션 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {grouped.map(({ status, items }) => {
          const isCollapsed = collapsed[status] ?? false
          const badgeColor = STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-600'

          return (
            <div
              key={status}
              style={{
                border: '1px solid #F0F3F6',
                borderRadius: 12,
                overflow: 'hidden',
                backgroundColor: '#ffffff',
              }}
            >
              {/* 섹션 헤더 */}
              <button
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '14px 18px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                }}
                onClick={() => toggleCollapse(status)}
              >
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeColor}`}>
                  {status}
                </span>
                <span style={{ fontSize: 12, color: '#adbac9' }}>{items.length}건</span>
                <span style={{ marginLeft: 'auto', color: '#ced7df', fontSize: 11 }}>{isCollapsed ? '▶' : '▼'}</span>
              </button>

              {/* 테이블 */}
              {!isCollapsed && (
                <div style={{ borderTop: '1px solid #F5F7FA', overflowX: 'auto' }}>
                  <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#FAFBFC' }}>
                        {['구분', '주관부처', '사업명', '마감일', 'D-day', '규모', '배정예산', '연구책임자', '작성담당자', '제안서', '발표자료'].map(h => (
                          <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600, color: '#adbac9', whiteSpace: 'nowrap', fontSize: 11, letterSpacing: '0.2px' }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {items.map(p => {
                        const dday = getDday(p.application_end)
                        return (
                          <tr
                            key={p.id}
                            style={{ borderTop: '1px solid #F5F7FA', cursor: 'pointer', transition: 'background 0.1s' }}
                            onClick={() => setSelectedProject(p)}
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#FAFBFC'}
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'}
                          >
                            <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                              <span style={{
                                fontSize: 11, padding: '2px 8px', borderRadius: 5, fontWeight: 600,
                                backgroundColor: p.category === 'R&D' ? '#F5F3FF' : p.category === '금융 지원' ? '#EFF6FF' : '#ECFDF3',
                                color: p.category === 'R&D' ? '#7C3AED' : p.category === '금융 지원' ? '#2563EB' : '#059669',
                              }}>
                                {p.category ?? '-'}
                              </span>
                            </td>
                            <td style={{ padding: '12px 14px', color: '#384e5d', whiteSpace: 'nowrap' }}>{p.ministry ?? '-'}</td>
                            <td style={{ padding: '12px 14px', maxWidth: 260 }}>
                              <div style={{ fontWeight: 600, color: '#1e2c33', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.project_name}</div>
                              {p.our_project_name && p.our_project_name !== p.project_name && (
                                <div style={{ fontSize: 11, color: '#adbac9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>{p.our_project_name}</div>
                              )}
                            </td>
                            <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', color: '#707d89' }}>
                              {p.application_end ? p.application_end.slice(0, 10) : '-'}
                            </td>
                            <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                              {dday
                                ? <span style={{ fontSize: 12, fontWeight: 700, color: dday.color }}>{dday.label}</span>
                                : <span style={{ color: '#ced7df' }}>-</span>}
                            </td>
                            <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', color: '#384e5d' }}>
                              {p.scale_100m ? `${p.scale_100m}억` : '-'}
                            </td>
                            <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', color: '#384e5d' }}>
                              {p.budget_total ? `${p.budget_total}억` : '-'}
                            </td>
                            <td style={{ padding: '12px 14px', color: '#707d89', whiteSpace: 'nowrap' }}>{p.manager ?? '-'}</td>
                            <td style={{ padding: '12px 14px', color: '#707d89', whiteSpace: 'nowrap' }}>{p.writer ?? '-'}</td>
                            <td style={{ padding: '12px 14px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                              {p.proposal_link
                                ? <a href={p.proposal_link} target="_blank" rel="noopener noreferrer" style={{ color: '#1e2c33', fontSize: 12, fontWeight: 500, textDecoration: 'none' }}>열기 ↗</a>
                                : <span style={{ color: '#ced7df' }}>-</span>}
                            </td>
                            <td style={{ padding: '12px 14px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                              {p.presentation_link
                                ? <a href={p.presentation_link} target="_blank" rel="noopener noreferrer" style={{ color: '#1e2c33', fontSize: 12, fontWeight: 500, textDecoration: 'none' }}>열기 ↗</a>
                                : <span style={{ color: '#ced7df' }}>-</span>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {showAddModal && (
        <AddEditProjectModal
          onClose={() => setShowAddModal(false)}
          onSave={(data) => { onAdd(data); setShowAddModal(false) }}
        />
      )}

      {selectedProject && (
        <ProjectDetailModal
          project={selectedProject}
          onClose={() => setSelectedProject(null)}
          onStatusChange={(status) => {
            onStatusChange(selectedProject.id, status)
            setSelectedProject({ ...selectedProject, status })
          }}
          onUpdate={(data) => {
            onUpdate(selectedProject.id, data)
            setSelectedProject({ ...selectedProject, ...data })
          }}
          onDelete={() => {
            onDelete(selectedProject.id)
            setSelectedProject(null)
          }}
        />
      )}
    </div>
  )
}
