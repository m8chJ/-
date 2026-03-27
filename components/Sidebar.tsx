'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'

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
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside
      style={{
        width: 220,
        minWidth: 220,
        backgroundColor: '#ffffff',
        borderRight: '1px solid #E8ECF0',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        position: 'sticky',
        top: 0,
      }}
    >
      {/* 로고 */}
      <div style={{ padding: '22px 20px 18px', borderBottom: '1px solid #F0F3F6' }}>
        <Image
          src="/logo.png"
          alt="Fitogether"
          width={120}
          height={36}
          style={{ objectFit: 'contain', objectPosition: 'left' }}
        />
        <div
          style={{
            fontSize: 11,
            color: '#adbac9',
            backgroundColor: '#F5F7FA',
            borderRadius: 6,
            padding: '4px 8px',
            display: 'inline-block',
            marginTop: 10,
          }}
        >
          정부지원사업 관리
        </div>
      </div>

      {/* 네비게이션 */}
      <nav style={{ flex: 1, padding: '16px 12px' }}>
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
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 10,
                marginBottom: 2,
                textDecoration: 'none',
                backgroundColor: isActive ? '#1e2c33' : 'transparent',
                color: isActive ? '#ffffff' : '#707d89',
                fontWeight: isActive ? 600 : 400,
                fontSize: 14,
                transition: 'all 0.15s',
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
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : '#ecf0f4',
                    color: isActive ? 'white' : '#384e5d',
                    padding: '2px 6px',
                    borderRadius: 4,
                    letterSpacing: '0.3px',
                  }}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* 하단 */}
      <div style={{ padding: '16px 20px', borderTop: '1px solid #F0F3F6' }}>
        <div style={{ fontSize: 11, color: '#ced7df', lineHeight: 1.6 }}>
          <div style={{ fontWeight: 600, color: '#adbac9', marginBottom: 2 }}>핏투게더</div>
          <div>gov-manager v1.0</div>
        </div>
      </div>
    </aside>
  )
}
