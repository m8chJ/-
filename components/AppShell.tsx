'use client'

import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import Sidebar from './Sidebar'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => { setSidebarOpen(false) }, [pathname])

  const isLogin = pathname === '/login'

  if (isLogin) return <div className="flex-1">{children}</div>

  return (
    <>
      {/* 모바일 오버레이 */}
      {isMobile && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 40 }}
        />
      )}

      {/* 사이드바 래퍼 */}
      <div style={{
        position: isMobile ? 'fixed' : 'relative',
        top: 0,
        left: isMobile ? (sidebarOpen ? 0 : -240) : 0,
        zIndex: 50,
        transition: isMobile ? 'left 0.25s ease' : undefined,
        height: isMobile ? '100vh' : undefined,
      }}>
        <Sidebar />
      </div>

      {/* 메인 컨텐츠 */}
      <div className="flex-1 overflow-auto" style={{ backgroundColor: '#F2F5FA', minWidth: 0 }}>
        {/* 모바일 상단 바 */}
        {isMobile && (
          <div style={{
            position: 'sticky', top: 0, zIndex: 30,
            backgroundColor: '#1e2c33',
            padding: '0 16px',
            height: 52,
            display: 'flex', alignItems: 'center', gap: 12,
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          }}>
            <button
              onClick={() => setSidebarOpen(true)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 2px', color: '#fff', display: 'flex', alignItems: 'center' }}
              aria-label="메뉴 열기"
            >
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#fff', letterSpacing: '-0.3px' }}>정부지원사업 관리</span>
          </div>
        )}
        {children}
      </div>
    </>
  )
}
