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
  if (diff < 0) return { label: '마감', color: 'text-gray-400' }
  if (diff === 0) return { label: 'D-Day', color: 'text-red-600 font-bold' }
  if (diff <= 7) return { label: `D-${diff}`, color: 'text-red-500 font-semibold' }
  if (diff <= 14) return { label: `D-${diff}`, color: 'text-orange-500' }
  return { label: `D-${diff}`, color: 'text-gray-400' }
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
      <div className="flex flex-wrap gap-3 mb-6 items-center">
        <input
          type="text"
          placeholder="사업명, 부처, 담당자로 검색..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e2c33] w-56"
        />
        <select
          value={managerFilter}
          onChange={e => setManagerFilter(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e2c33] text-gray-600"
        >
          {managers.map(m => <option key={m}>{m}</option>)}
        </select>
        <div className="ml-auto">
          <button
            onClick={() => setShowAddModal(true)}
            style={{ backgroundColor: '#1e2c33' }}
            className="px-4 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90"
          >
            + 공고 추가
          </button>
        </div>
      </div>

      {/* 상태별 섹션 */}
      <div className="space-y-4">
        {grouped.map(({ status, items }) => {
          const isCollapsed = collapsed[status] ?? false
          const badgeColor = STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-600'

          return (
            <div key={status} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* 섹션 헤더 */}
              <button
                className="w-full flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition-colors text-left"
                onClick={() => toggleCollapse(status)}
              >
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeColor}`}>
                  {status}
                </span>
                <span className="text-gray-500 text-sm">{items.length}건</span>
                <span className="ml-auto text-gray-400 text-sm">{isCollapsed ? '▶' : '▼'}</span>
              </button>

              {/* 테이블 */}
              {!isCollapsed && (
                <div className="border-t border-gray-100 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="text-left px-4 py-2.5 font-medium text-gray-500 whitespace-nowrap">구분</th>
                        <th className="text-left px-4 py-2.5 font-medium text-gray-500 whitespace-nowrap">주관부처</th>
                        <th className="text-left px-4 py-2.5 font-medium text-gray-500">사업명</th>
                        <th className="text-left px-4 py-2.5 font-medium text-gray-500 whitespace-nowrap">마감일</th>
                        <th className="text-left px-4 py-2.5 font-medium text-gray-500 whitespace-nowrap">D-day</th>
                        <th className="text-left px-4 py-2.5 font-medium text-gray-500 whitespace-nowrap">규모(억)</th>
                        <th className="text-left px-4 py-2.5 font-medium text-gray-500 whitespace-nowrap">배정 사업비</th>
                        <th className="text-left px-4 py-2.5 font-medium text-gray-500 whitespace-nowrap">연구책임자</th>
                        <th className="text-left px-4 py-2.5 font-medium text-gray-500 whitespace-nowrap">작성 담당자</th>
                        <th className="text-left px-4 py-2.5 font-medium text-gray-500 whitespace-nowrap">제안서</th>
                        <th className="text-left px-4 py-2.5 font-medium text-gray-500 whitespace-nowrap">발표자료</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map(p => {
                        const dday = getDday(p.application_end)
                        return (
                          <tr
                            key={p.id}
                            className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors"
                            onClick={() => setSelectedProject(p)}
                          >
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                                p.category === 'R&D' ? 'bg-violet-100 text-violet-700'
                                : p.category === '금융 지원' ? 'bg-sky-100 text-sky-700'
                                : 'bg-emerald-100 text-emerald-700'
                              }`}>
                                {p.category ?? '-'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{p.ministry ?? '-'}</td>
                            <td className="px-4 py-3 text-gray-900 font-medium max-w-xs">
                              <div className="truncate">{p.project_name}</div>
                              {p.our_project_name && p.our_project_name !== p.project_name && (
                                <div className="text-xs text-gray-400 truncate mt-0.5">{p.our_project_name}</div>
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                              {p.application_end ? p.application_end.slice(0, 10) : '-'}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              {dday ? <span className={`text-xs font-medium ${dday.color}`}>{dday.label}</span> : '-'}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                              {p.scale_100m ? `${p.scale_100m}억` : '-'}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                              {p.budget_total ? `${p.budget_total}억` : '-'}
                            </td>
                            <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{p.manager ?? '-'}</td>
                            <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{p.writer ?? '-'}</td>
                            <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                              {p.proposal_link
                                ? <a href={p.proposal_link} target="_blank" rel="noopener noreferrer" className="text-[#1e2c33] hover:underline text-xs">열기 🔗</a>
                                : <span className="text-gray-300">-</span>}
                            </td>
                            <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                              {p.presentation_link
                                ? <a href={p.presentation_link} target="_blank" rel="noopener noreferrer" className="text-[#1e2c33] hover:underline text-xs">열기 🔗</a>
                                : <span className="text-gray-300">-</span>}
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
