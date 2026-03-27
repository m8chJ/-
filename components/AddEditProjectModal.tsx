'use client'

import { useState } from 'react'
import { Project, STATUS_LIST } from '@/types/project'

type Props = {
  project?: Project
  onClose: () => void
  onSave: (data: Partial<Project>) => void
}

const EMPTY: Partial<Project> = {
  category: '',
  ministry: '',
  project_name: '',
  application_start: '',
  application_end: '',
  scale_100m: undefined,
  duration: '',
  eligibility: '',
  support_content: '',
  status: '검토중',
  manager: '',
  writer: '',
  our_project_name: '',
  implementation_type: '',
  consortium: '',
  budget_total: undefined,
  notes: '',
  has_announcement: false,
  has_form: false,
  has_proposal: false,
  has_presentation: false,
}

export default function AddEditProjectModal({ project, onClose, onSave }: Props) {
  const [form, setForm] = useState<Partial<Project>>(project ?? EMPTY)

  const set = (key: keyof Project, value: unknown) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">
            {project ? '공고 수정' : '새 공고 추가'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        <div className="p-6 grid grid-cols-2 gap-4 text-sm">
          <Field label="사업명 *" colSpan>
            <input className={input} value={form.project_name ?? ''} onChange={e => set('project_name', e.target.value)} />
          </Field>

          <Field label="구분">
            <select className={input} value={form.category ?? ''} onChange={e => set('category', e.target.value)}>
              <option value="">선택</option>
              <option>R&D</option>
              <option>지원사업</option>
              <option>금융 지원</option>
            </select>
          </Field>

          <Field label="주관부처">
            <input className={input} value={form.ministry ?? ''} onChange={e => set('ministry', e.target.value)} />
          </Field>

          <Field label="지원 시작">
            <input type="date" className={input} value={form.application_start ?? ''} onChange={e => set('application_start', e.target.value)} />
          </Field>

          <Field label="지원 마감">
            <input type="date" className={input} value={form.application_end ?? ''} onChange={e => set('application_end', e.target.value)} />
          </Field>

          <Field label="규모 (억원)">
            <input type="number" className={input} value={form.scale_100m ?? ''} onChange={e => set('scale_100m', e.target.value ? Number(e.target.value) : undefined)} />
          </Field>

          <Field label="기간">
            <input className={input} value={form.duration ?? ''} onChange={e => set('duration', e.target.value)} />
          </Field>

          <Field label="상태">
            <select className={input} value={form.status ?? '검토중'} onChange={e => set('status', e.target.value)}>
              {STATUS_LIST.filter(s => s !== '전체').map(s => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>

          <Field label="총괄 책임자">
            <input className={input} value={form.manager ?? ''} onChange={e => set('manager', e.target.value)} />
          </Field>

          <Field label="작성 책임자">
            <input className={input} value={form.writer ?? ''} onChange={e => set('writer', e.target.value)} />
          </Field>

          <Field label="추진 과제명" colSpan>
            <input className={input} value={form.our_project_name ?? ''} onChange={e => set('our_project_name', e.target.value)} />
          </Field>

          <Field label="수행 형태">
            <select className={input} value={form.implementation_type ?? ''} onChange={e => set('implementation_type', e.target.value)}>
              <option value="">선택</option>
              <option>단독</option>
              <option>주관</option>
              <option>공동</option>
            </select>
          </Field>

          <Field label="컨소시엄 파트너">
            <input className={input} value={form.consortium ?? ''} onChange={e => set('consortium', e.target.value)} />
          </Field>

          <Field label="배정 사업비 총액 (억원)" colSpan>
            <input type="number" className={input} value={form.budget_total ?? ''} onChange={e => set('budget_total', e.target.value ? Number(e.target.value) : undefined)} />
          </Field>

          <Field label="지원 대상" colSpan>
            <textarea className={input + ' resize-none'} rows={2} value={form.eligibility ?? ''} onChange={e => set('eligibility', e.target.value)} />
          </Field>

          <Field label="지원 내용" colSpan>
            <textarea className={input + ' resize-none'} rows={2} value={form.support_content ?? ''} onChange={e => set('support_content', e.target.value)} />
          </Field>

          <Field label="비고" colSpan>
            <textarea className={input + ' resize-none'} rows={2} value={form.notes ?? ''} onChange={e => set('notes', e.target.value)} />
          </Field>

          <div className="col-span-2 flex gap-6">
            {([['has_proposal', '제안서'], ['has_presentation', '발표자료'], ['has_announcement', '공고문'], ['has_form', '지원양식']] as const).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!form[key]}
                  onChange={e => set(key, e.target.checked)}
                  className="w-4 h-4 accent-[#1e2c33]"
                />
                <span className="text-gray-700">{label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 pb-6">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm">취소</button>
          <button
            onClick={() => onSave(form)}
            style={{ backgroundColor: '#1e2c33' }}
            className="px-4 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90"
          >
            {project ? '수정 완료' : '추가'}
          </button>
        </div>
      </div>
    </div>
  )
}

const input = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e2c33]'

function Field({ label, children, colSpan }: { label: string; children: React.ReactNode; colSpan?: boolean }) {
  return (
    <div className={colSpan ? 'col-span-2' : ''}>
      <label className="block text-gray-500 mb-1">{label}</label>
      {children}
    </div>
  )
}
