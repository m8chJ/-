'use client'

import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import Sidebar from './Sidebar'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  useEffect(() => { setOpen(false) }, [pathname])

  const isLogin = pathname === '/login'
  if (isLogin) return <div className="flex-1">{children}</div>

  return (
    <>
      {/* 모바일 오버레이 — CSS가 display: none으로 숨기고 모바일에서만 표시 */}
      {open && (
        <div className="mobile-overlay" onClick={() => setOpen(false)} />
      )}

      {/* 사이드바 — CSS media query가 모바일에서 position: fixed + translate로 처리 */}
      <div className={`sidebar-wrapper${open ? ' open' : ''}`}>
        <Sidebar />
      </div>

      {/* 메인 콘텐츠 */}
      <div className="main-content" style={{ backgroundColor: '#F2F5FA' }}>
        {/* 모바일 상단 바 — CSS가 데스크탑에서 display: none */}
        <div className="mobile-topbar">
          <button
            onClick={() => setOpen(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 2px', color: '#fff', display: 'flex', alignItems: 'center' }}
            aria-label="메뉴 열기"
          >
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#fff', letterSpacing: '-0.3px' }}>
            정부지원사업 관리
          </span>
        </div>
        {children}
      </div>
    </>
  )
}
