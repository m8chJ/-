'use client'

import { useState } from 'react'
import { Project, STATUS_LIST } from '@/types/project'
import StatusBadge from './StatusBadge'
import ProjectDetailModal from './ProjectDetailModal'

type Props = {
  projects: Project[]
  onStatusChange: (id: string, status: string) => void
}

export default function ProjectTable({ projects, onStatusChange }: Props) {
  const [selectedStatus, setSelectedStatus] = useState('전체')
  const [search, setSearch] = useState('')
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)

  const filtered = projects.filter((p) => {
    const matchStatus =
      selectedStatus === '전체' ||
      p.status === selectedStatus ||
      p.status?.replace(' ', '') === selectedStatus.replace(' ', '')
    const matchSearch =
      search === '' ||
      p.project_name.includes(search) ||
      (p.ministry ?? '').includes(search) ||
      (p.manager ?? '').includes(search) ||
      (p.writer ?? '').includes(search)
    return matchStatus && matchSearch
  })

  const statusCounts = projects.reduce<Record<string, number>>((acc, p) => {
    const s = p.status ?? '검토중'
    acc[s] = (acc[s] ?? 0) + 1
    return acc
  }, {})

  return (
    <div>
      {/* 상태 탭 */}
      <div className="flex flex-wrap gap-2 mb-4">
        {STATUS_LIST.map((s) => {
          const count = s === '전체'
            ? projects.length
            : Object.entries(statusCounts)
                .filter(([k]) => k === s || k.replace(' ', '') === s.replace(' ', ''))
                .reduce((a, [, v]) => a + v, 0)
          return (
            <button
              key={s}
              onClick={() => setSelectedStatus(s)}
              style={selectedStatus === s ? { backgroundColor: '#7ccbd2' } : {}}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                selectedStatus === s
                  ? 'text-white border-transparent'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {s} {count > 0 && <span className="ml-1 opacity-70">{count}</span>}
            </button>
          )
        })}
      </div>

      {/* 검색 */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="사업명, 부처, 담당자로 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
        />
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
                <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">마감일</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">규모(억)</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">상태</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">총괄</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">작성</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">제안서</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-gray-400">
                    해당 조건의 공고가 없습니다.
                  </td>
                </tr>
              )}
              {filtered.map((p) => (
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
                  <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                    {p.scale_100m ? `${p.scale_100m}억` : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{p.manager ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{p.writer ?? '-'}</td>
                  <td className="px-4 py-3 text-center">
                    {p.has_proposal ? (
                      <span className="text-green-500">✓</span>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-sm text-gray-500">
          총 {filtered.length}건
        </div>
      </div>

      {selectedProject && (
        <ProjectDetailModal
          project={selectedProject}
          onClose={() => setSelectedProject(null)}
          onStatusChange={(status) => {
            onStatusChange(selectedProject.id, status)
            setSelectedProject({ ...selectedProject, status })
          }}
        />
      )}
    </div>
  )
}
