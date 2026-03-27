'use client'

import { useState, useMemo } from 'react'
import { Project, STATUS_LIST } from '@/types/project'
import StatusBadge from './StatusBadge'
import ProjectDetailModal from './ProjectDetailModal'
import AddEditProjectModal from './AddEditProjectModal'

type SortKey = 'application_end' | 'scale_100m' | 'status' | ''

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

export default function ProjectTable({ projects, onStatusChange, onAdd, onUpdate, onDelete }: Props) {
  const [selectedStatus, setSelectedStatus] = useState('전체')
  const [search, setSearch] = useState('')
  const [managerFilter, setManagerFilter] = useState('전체')
  const [sortKey, setSortKey] = useState<SortKey>('application_end')
  const [sortAsc, setSortAsc] = useState(true)
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

  const filtered = useMemo(() => {
    let list = projects.filter((p) => {
      const matchStatus =
        selectedStatus === '전체' ||
        p.status === selectedStatus ||
        p.status?.replace(/\s/g, '') === selectedStatus.replace(/\s/g, '')
      const matchSearch =
        search === '' ||
        p.project_name.includes(search) ||
        (p.ministry ?? '').includes(search) ||
        (p.manager ?? '').includes(search) ||
        (p.writer ?? '').includes(search)
      const matchManager =
        managerFilter === '전체' ||
        p.manager === managerFilter ||
        p.writer === managerFilter
      return matchStatus && matchSearch && matchManager
    })

    if (sortKey) {
      list = [...list].sort((a, b) => {
        let av: string | number | null = null
        let bv: string | number | null = null
        if (sortKey === 'application_end') {
          av = a.application_end ?? ''
          bv = b.application_end ?? ''
        } else if (sortKey === 'scale_100m') {
          av = a.scale_100m ?? -1
          bv = b.scale_100m ?? -1
        } else if (sortKey === 'status') {
          av = a.status ?? ''
          bv = b.status ?? ''
        }
        if (av === null || av === '') return 1
        if (bv === null || bv === '') return -1
        if (av < bv) return sortAsc ? -1 : 1
        if (av > bv) return sortAsc ? 1 : -1
        return 0
      })
    }
    return list
  }, [projects, selectedStatus, search, managerFilter, sortKey, sortAsc])

  const statusCounts = projects.reduce<Record<string, number>>((acc, p) => {
    const s = p.status ?? '검토중'
    acc[s] = (acc[s] ?? 0) + 1
    return acc
  }, {})

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(!sortAsc)
    else { setSortKey(key); setSortAsc(true) }
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <span className="text-gray-300 ml-1">↕</span>
    return <span className="ml-1" style={{ color: '#1e2c33' }}>{sortAsc ? '↑' : '↓'}</span>
  }

  return (
    <div>
      {/* 상태 탭 */}
      <div className="flex flex-wrap gap-2 mb-4">
        {STATUS_LIST.map((s) => {
          const count = s === '전체'
            ? projects.length
            : Object.entries(statusCounts)
                .filter(([k]) => k === s || k.replace(/\s/g, '') === s.replace(/\s/g, ''))
                .reduce((a, [, v]) => a + v, 0)
          return (
            <button
              key={s}
              onClick={() => setSelectedStatus(s)}
              style={selectedStatus === s ? { backgroundColor: '#1e2c33' } : {}}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                selectedStatus === s
                  ? 'text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {s} {count > 0 && <span className="ml-1 opacity-70">{count}</span>}
            </button>
          )
        })}
      </div>

      {/* 검색 + 담당자 필터 + 정렬 + 추가 버튼 */}
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <input
          type="text"
          placeholder="사업명, 부처, 담당자로 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e2c33] w-56"
        />

        <select
          value={managerFilter}
          onChange={(e) => setManagerFilter(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e2c33] text-gray-600"
        >
          {managers.map(m => <option key={m}>{m}</option>)}
        </select>

        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e2c33] text-gray-600"
        >
          <option value="application_end">마감일순</option>
          <option value="scale_100m">규모순</option>
          <option value="status">상태순</option>
        </select>

        <button
          onClick={() => setSortAsc(!sortAsc)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
        >
          {sortAsc ? '오름차순 ↑' : '내림차순 ↓'}
        </button>

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

      {/* 테이블 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">구분</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">주관부처</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">사업명</th>
                <th
                  className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap cursor-pointer hover:text-gray-900"
                  onClick={() => handleSort('application_end')}
                >
                  마감일 <SortIcon k="application_end" />
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">D-day</th>
                <th
                  className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap cursor-pointer hover:text-gray-900"
                  onClick={() => handleSort('scale_100m')}
                >
                  규모(억) <SortIcon k="scale_100m" />
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">배정 사업비</th>
                <th
                  className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap cursor-pointer hover:text-gray-900"
                  onClick={() => handleSort('status')}
                >
                  상태 <SortIcon k="status" />
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">연구책임자</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">작성 담당자</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">제안서</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">발표자료</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-gray-400">
                    해당 조건의 공고가 없습니다.
                  </td>
                </tr>
              )}
              {filtered.map((p) => {
                const dday = getDday(p.application_end)
                return (
                  <tr
                    key={p.id}
                    className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => setSelectedProject(p)}
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                        p.category === 'R&D'
                          ? 'bg-violet-100 text-violet-700'
                          : p.category === '금융 지원'
                          ? 'bg-sky-100 text-sky-700'
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
                      {dday ? (
                        <span className={`text-xs font-medium ${dday.color}`}>{dday.label}</span>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                      {p.scale_100m ? `${p.scale_100m}억` : '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                      {p.budget_total ? `${p.budget_total}억` : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{p.manager ?? '-'}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{p.writer ?? '-'}</td>
                    <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                      {p.proposal_link
                        ? <a href={p.proposal_link} target="_blank" rel="noopener noreferrer" className="text-[#1e2c33] hover:underline text-xs">열기 🔗</a>
                        : <span className="text-gray-300">-</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                      {p.presentation_link
                        ? <a href={p.presentation_link} target="_blank" rel="noopener noreferrer" className="text-[#1e2c33] hover:underline text-xs">열기 🔗</a>
                        : <span className="text-gray-300">-</span>
                      }
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-sm text-gray-500">
          총 {filtered.length}건
        </div>
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
