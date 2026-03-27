'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const navItems = [
  {
    href: '/',
    label: '대시보드',
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    href: '/recommend',
    label: '공고 추천 AI',
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    ),
    badge: 'AI',
  },
  {
    href: '/budget',
    label: '사업비 관리',
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75" />
      </svg>
    ),
  },
  {
    href: '/participation',
    label: '참여율 관리',
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
  },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null)
    })
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside style={{
      width: 220,
      minWidth: 220,
      backgroundColor: '#ffffff',
      borderRight: '1px solid #E8ECF0',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      position: 'sticky',
      top: 0,
    }}>
      {/* 로고 */}
      <div style={{ padding: '22px 20px 18px', borderBottom: '1px solid #F0F3F6' }}>
        <Image src="/logo.png" alt="Fitogether" width={120} height={36} style={{ objectFit: 'contain', objectPosition: 'left' }} />
        <div style={{
          fontSize: 11, color: '#adbac9', backgroundColor: '#F5F7FA',
          borderRadius: 6, padding: '4px 8px', display: 'inline-block', marginTop: 10,
        }}>
          정부지원사업 관리
        </div>
      </div>

      {/* 네비게이션 */}
      <nav style={{ flex: 1, padding: '16px 12px', overflowY: 'auto' }}>
        <p style={{ fontSize: 10, color: '#adbac9', fontWeight: 600, letterSpacing: '0.5px', padding: '0 8px', marginBottom: 8 }}>
          MENU
        </p>
        {navItems.map(item => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 10, marginBottom: 2,
                textDecoration: 'none',
                backgroundColor: isActive ? '#1e2c33' : 'transparent',
                color: isActive ? '#ffffff' : '#707d89',
                fontWeight: isActive ? 600 : 400,
                fontSize: 14, transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.backgroundColor = '#F5F7FA'
                  ;(e.currentTarget as HTMLElement).style.color = '#1e2c33'
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'
                  ;(e.currentTarget as HTMLElement).style.color = '#707d89'
                }
              }}
            >
              <span style={{ opacity: isActive ? 1 : 0.7 }}>{item.icon}</span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.badge && (
                <span style={{
                  fontSize: 9, fontWeight: 700,
                  backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : '#ecf0f4',
                  color: isActive ? 'white' : '#384e5d',
                  padding: '2px 6px', borderRadius: 4, letterSpacing: '0.3px',
                }}>
                  {item.badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* 하단 유저 정보 + 로그아웃 */}
      <div style={{ padding: '14px 16px', borderTop: '1px solid #F0F3F6' }}>
        {userEmail && (
          <div style={{ marginBottom: 10, padding: '8px 10px', backgroundColor: '#F5F7FA', borderRadius: 8 }}>
            <p style={{ fontSize: 10, color: '#adbac9', marginBottom: 2 }}>로그인 계정</p>
            <p style={{ fontSize: 12, color: '#384e5d', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {userEmail}
            </p>
          </div>
        )}
        <button
          onClick={handleLogout}
          style={{
            width: '100%', padding: '9px', borderRadius: 8,
            backgroundColor: 'transparent', border: '1px solid #E8ECF0',
            color: '#707d89', fontSize: 12, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
          </svg>
          로그아웃
        </button>
      </div>
    </aside>
  )
}
