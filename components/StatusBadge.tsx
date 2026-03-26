'use client'
import { STATUS_COLORS } from '@/types/project'

export default function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null
  const color = STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-600'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${color}`}>
      {status}
    </span>
  )
}
