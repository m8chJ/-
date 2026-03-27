import type { Metadata } from 'next'
import './globals.css'
import Sidebar from '@/components/Sidebar'

export const metadata: Metadata = {
  title: '정부지원사업 관리 | 핏투게더',
  description: '정부지원사업 공고 관리 및 예산 관리',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="h-full">
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
          rel="stylesheet"
        />
      </head>
      <body
        className="h-full flex antialiased"
        style={{ fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif" }}
      >
        <Sidebar />
        <div className="flex-1 overflow-auto" style={{ backgroundColor: '#F2F5FA' }}>
          {children}
        </div>
      </body>
    </html>
  )
}
