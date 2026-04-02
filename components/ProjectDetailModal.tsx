'use client'

import { useState, useCallback } from 'react'
import { Project, STATUS_LIST } from '@/types/project'
import AddEditProjectModal from './AddEditProjectModal'

type Props = {
  project: Project
  onClose: () => void
  onStatusChange: (status: string) => void
  onUpdate: (data: Partial<Project>) => void
  onDelete: () => void
}

export default function ProjectDetailModal({ project: p, onClose, onStatusChange, onUpdate, onDelete }: Props) {
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (editing) {
    return (
      <AddEditProjectModal
        project={p}
        onClose={() => setEditing(false)}
        onSave={(data) => { onUpdate(data); setEditing(false) }}
      />
    )
  }

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
          <div className="flex items-center gap-2 ml-4">
            <button
              onClick={() => setEditing(true)}
              className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
            >
              수정
            </button>
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="px-3 py-1.5 text-xs border border-red-200 rounded-lg text-red-500 hover:bg-red-50"
              >
                삭제
              </button>
            ) : (
              <div className="flex items-center gap-1">
                <span className="text-xs text-red-500">정말 삭제?</span>
                <button onClick={onDelete} className="px-2 py-1 text-xs bg-red-500 text-white rounded-lg">확인</button>
                <button onClick={() => setConfirmDelete(false)} className="px-2 py-1 text-xs border border-gray-200 rounded-lg text-gray-500">취소</button>
              </div>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
          </div>
        </div>

        {/* 상태 변경 */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
          <p className="text-xs text-gray-500 mb-2 font-medium">상태 변경</p>
          <div className="flex flex-wrap gap-2">
            {STATUS_LIST.filter(s => s !== '전체').map((s) => (
              <button
                key={s}
                onClick={() => onStatusChange(s)}
                style={p.status === s || p.status?.replace(' ', '') === s.replace(' ', '') ? { backgroundColor: '#1e2c33', borderColor: '#1e2c33' } : {}}
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
          <Info label="참여 형태" value={p.implementation_type} />
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

          <div className="col-span-2 bg-gray-50 rounded-lg p-4 space-y-3">
            <p className="text-gray-500 font-medium text-xs mb-2">문서 링크</p>
            <LinkField
              label="제안서"
              link={p.proposal_link}
              onSave={(link) => onUpdate({ ...p, proposal_link: link })}
            />
            <LinkField
              label="발표자료"
              link={p.presentation_link}
              onSave={(link) => onUpdate({ ...p, presentation_link: link })}
            />
          </div>

          {p.notes && (
            <div className="col-span-2">
              <p className="text-gray-400 mb-1">비고</p>
              <p className="text-gray-800">{p.notes}</p>
            </div>
          )}

          {(p.status === '미선정' || p.status === '지원불가') && (
            <div className="col-span-2 bg-red-50 rounded-lg p-4">
              <p className="text-red-400 mb-2 text-xs font-medium">미선정 사유</p>
              <RejectionReasonEditor
                value={p.rejection_reason}
                onSave={(reason) => onUpdate({ ...p, rejection_reason: reason })}
              />
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

function LinkField({ label, link, onSave }: { label: string; link: string | null; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(link ?? '')

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-gray-500 text-sm w-16 shrink-0">{label}</span>
        {link ? (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-[#1e2c33] hover:underline flex items-center gap-1 truncate"
            onClick={(e) => e.stopPropagation()}
          >
            열기 🔗
          </a>
        ) : (
          <span className="text-gray-300 text-sm">링크 없음</span>
        )}
        <button
          onClick={() => setEditing(true)}
          className="ml-auto text-xs text-gray-400 hover:text-gray-600 shrink-0"
        >
          {link ? '수정' : '입력'}
        </button>
      </div>
    )
  }

  return (
    <div>
      <p className="text-gray-500 text-sm mb-1">{label} 링크</p>
      <div className="flex gap-2">
        <input
          className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e2c33]"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="https://drive.google.com/..."
          autoFocus
        />
        <button
          onClick={() => { onSave(text); setEditing(false) }}
          style={{ backgroundColor: '#1e2c33' }}
          className="px-3 py-1.5 text-xs text-white rounded-lg"
        >
          저장
        </button>
        <button
          onClick={() => { setText(link ?? ''); setEditing(false) }}
          className="px-3 py-1.5 text-xs border border-gray-200 text-gray-500 rounded-lg"
        >
          취소
        </button>
      </div>
    </div>
  )
}

function RejectionReasonEditor({ value, onSave }: { value: string | null; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(value ?? '')

  if (!editing) {
    return (
      <div className="flex items-start gap-2">
        <p className="text-gray-700 flex-1 text-sm">{value || '사유를 입력해주세요.'}</p>
        <button
          onClick={() => setEditing(true)}
          className="text-xs text-red-400 hover:text-red-600 whitespace-nowrap"
        >
          {value ? '수정' : '입력'}
        </button>
      </div>
    )
  }

  return (
    <div>
      <textarea
        className="w-full px-3 py-2 border border-red-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-300 resize-none bg-white"
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="미선정 사유를 입력하세요..."
        autoFocus
      />
      <div className="flex gap-2 mt-2">
        <button
          onClick={() => { onSave(text); setEditing(false) }}
          className="px-3 py-1 text-xs bg-red-400 text-white rounded-lg hover:bg-red-500"
        >
          저장
        </button>
        <button
          onClick={() => { setText(value ?? ''); setEditing(false) }}
          className="px-3 py-1 text-xs border border-gray-200 text-gray-500 rounded-lg hover:bg-gray-50"
        >
          취소
        </button>
      </div>
    </div>
  )
}
