export type Project = {
  id: string
  category: string | null
  ministry: string | null
  project_name: string
  has_announcement: boolean
  has_form: boolean
  expected_announcement_date: string | null
  result_date: string | null
  application_start: string | null
  application_end: string | null
  scale_100m: number | null
  duration: string | null
  eligibility: string | null
  bonus_points: string | null
  support_content: string | null
  status: string | null
  manager: string | null
  writer: string | null
  our_project_name: string | null
  implementation_type: string | null
  consortium: string | null
  budget_total: number | null
  budget_year1: number | null
  budget_year2: number | null
  budget_year3: number | null
  budget_year4: number | null
  has_proposal: boolean
  has_presentation: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export const STATUS_LIST = [
  '전체',
  '최종 선정',
  '서류 통과',
  '제출 완료',
  '지원예정',
  '공고 예정',
  '미선정',
  '지원불가',
  '검토중',
]

export const STATUS_COLORS: Record<string, string> = {
  '최종 선정': 'bg-green-100 text-green-800',
  '최종선정': 'bg-green-100 text-green-800',
  '서류 통과': 'bg-blue-100 text-blue-800',
  '서류통과': 'bg-blue-100 text-blue-800',
  '제출 완료': 'bg-indigo-100 text-indigo-800',
  '지원예정': 'bg-yellow-100 text-yellow-800',
  '공고 예정': 'bg-orange-100 text-orange-800',
  '미선정': 'bg-gray-100 text-gray-600',
  '지원불가': 'bg-red-100 text-red-600',
  '검토중': 'bg-purple-100 text-purple-800',
}
