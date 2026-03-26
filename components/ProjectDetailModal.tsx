'use client'

import { Project, STATUS_LIST } from '@/types/project'
import StatusBadge from './StatusBadge'

type Props = {
  project: Project
  onClose: () => void
  onStatusChange: (status: string) => void
}

export default function ProjectDetailModal({ project: p, onClose, onStatusChange }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-start justify-between p-6 border-b border-gray-100">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                p.category === 'R&D'
                  ? 'bg-violet-100 text-violet-700'
                  : p.category === '금융 지원'
                  ? 'bg-sky-100 text-sky-700'
                  : 'bg-emerald-100 text-emerald-700'
              }`}>{p.category ?? '-'}</span>
              <span className="text-sm text-gray-400">{p.ministry}</span>
            </div>
            <h2 className="text-lg font-semibold text-gray-900">{p.project_name}</h2>
            {p.our_project_name && p.our_project_name !== p.project_name && (
              <p className="text-sm text-gray-500 mt-1">→ {p.our_project_name}</p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl ml-4">✕</button>
        </div>

        {/* 상태 변경 */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
          <p className="text-xs text-gray-500 mb-2 font-medium">상태 변경</p>
          <div className="flex flex-wrap gap-2">
            {STATUS_LIST.filter(s => s !== '전체').map((s) => (
              <button
                key={s}
                onClick={() => onStatusChange(s)}
              style={p.status === s || p.status?.replace(' ', '') === s.replace(' ', '') ? { backgroundColor: '#7ccbd2', borderColor: '#7ccbd2' } : {}}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                  p.status === s || p.status?.replace(' ', '') === s.replace(' ', '')
                    ? 'text-white'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* 상세 정보 */}
        <div className="p-6 grid grid-cols-2 gap-4 text-sm">
          <Info label="지원 마감" value={p.application_end?.slice(0, 10)} />
          <Info label="지원 시작" value={p.application_start?.slice(0, 10)} />
          <Info label="규모" value={p.scale_100m ? `${p.scale_100m}억원` : null} />
          <Info label="기간" value={p.duration} />
          <Info label="수행 형태" value={p.implementation_type} />
          <Info label="컨소시엄" value={p.consortium} />
          <Info label="총괄 책임자" value={p.manager} />
          <Info label="작성 책임자" value={p.writer} />
          <Info label="발표일" value={p.result_date} />
          <Info label="우대 가점" value={p.bonus_points} />

          {p.eligibility && (
            <div className="col-span-2">
              <p className="text-gray-400 mb-1">지원 대상</p>
              <p className="text-gray-800">{p.eligibility}</p>
            </div>
          )}

          {p.support_content && (
            <div className="col-span-2">
              <p className="text-gray-400 mb-1">지원 내용</p>
              <p className="text-gray-800">{p.support_content}</p>
            </div>
          )}

          {(p.budget_total || p.budget_year1) && (
            <div className="col-span-2 bg-blue-50 rounded-lg p-4">
              <p className="text-gray-500 mb-2 font-medium">배정 사업비</p>
              <div className="flex gap-4 flex-wrap">
                {p.budget_total && <div><span className="text-gray-400 text-xs">총액</span><br /><span className="font-semibold">{p.budget_total}억</span></div>}
                {p.budget_year1 && <div><span className="text-gray-400 text-xs">1년차</span><br /><span className="font-semibold">{p.budget_year1}억</span></div>}
                {p.budget_year2 && <div><span className="text-gray-400 text-xs">2년차</span><br /><span className="font-semibold">{p.budget_year2}억</span></div>}
                {p.budget_year3 && <div><span className="text-gray-400 text-xs">3년차</span><br /><span className="font-semibold">{p.budget_year3}억</span></div>}
                {p.budget_year4 && <div><span className="text-gray-400 text-xs">4년차</span><br /><span className="font-semibold">{p.budget_year4}억</span></div>}
              </div>
            </div>
          )}

          <div className="col-span-2 flex gap-4">
            <div className="flex items-center gap-2">
              <span className={p.has_proposal ? 'text-green-500' : 'text-gray-300'}>●</span>
              <span className="text-gray-600">제안서 {p.has_proposal ? '있음' : '없음'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={p.has_presentation ? 'text-green-500' : 'text-gray-300'}>●</span>
              <span className="text-gray-600">발표자료 {p.has_presentation ? '있음' : '없음'}</span>
            </div>
          </div>

          {p.notes && (
            <div className="col-span-2">
              <p className="text-gray-400 mb-1">비고</p>
              <p className="text-gray-800">{p.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-gray-400 mb-0.5">{label}</p>
      <p className="text-gray-800">{value ?? '-'}</p>
    </div>
  )
}
