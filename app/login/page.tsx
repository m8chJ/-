'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Image from 'next/image'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('이메일 또는 비밀번호가 올바르지 않습니다.')
      setLoading(false)
    } else {
      router.push('/')
      router.refresh()
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#F2F5FA',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Pretendard', -apple-system, sans-serif",
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: 20,
        padding: '48px 44px',
        width: 400,
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
      }}>
        {/* 로고 */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Image src="/logo.png" alt="Fitogether" width={140} height={42} style={{ objectFit: 'contain' }} />
          <p style={{ fontSize: 13, color: '#adbac9', marginTop: 10 }}>정부지원사업 관리 시스템</p>
        </div>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#707d89', display: 'block', marginBottom: 6 }}>
              이메일
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="이메일 주소"
              required
              style={{
                width: '100%',
                padding: '12px 14px',
                border: '1px solid #E8ECF0',
                borderRadius: 10,
                fontSize: 14,
                outline: 'none',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
                color: '#1e2c33',
              }}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#707d89', display: 'block', marginBottom: 6 }}>
              비밀번호
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="비밀번호"
              required
              style={{
                width: '100%',
                padding: '12px 14px',
                border: '1px solid #E8ECF0',
                borderRadius: 10,
                fontSize: 14,
                outline: 'none',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
                color: '#1e2c33',
              }}
            />
          </div>

          {error && (
            <div style={{
              backgroundColor: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: 8,
              padding: '10px 14px',
              fontSize: 13,
              color: '#DC2626',
              marginBottom: 16,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: 10,
              backgroundColor: loading ? '#adbac9' : '#1e2c33',
              color: '#ffffff',
              fontSize: 14,
              fontWeight: 700,
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              transition: 'background 0.15s',
            }}
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>
      </div>
    </div>
  )
}
