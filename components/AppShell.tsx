'use client'

import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isLogin = pathname === '/login'

  if (isLogin) {
    return <div className="flex-1">{children}</div>
  }

  return (
    <>
      <Sidebar />
      <div className="flex-1 overflow-auto" style={{ backgroundColor: '#F2F5FA' }}>
        {children}
      </div>
    </>
  )
}
