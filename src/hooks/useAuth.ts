import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { clearAuthToken } from '@/lib/utils/helpers/cookies'

interface User {
  id: string
  email: string
  name: string | null
  role: string
  verified: boolean
  balance?: number  // 添加 balance 字段（可选，因为某些API可能不返回）
}

interface UseAuthReturn {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  logout: () => void
  checkAuth: (redirectPath?: string) => boolean
}

export function useAuth(requireAuth: boolean = false): UseAuthReturn {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    const userData = localStorage.getItem('user')

    if (!token || !userData) {
      setIsLoading(false)
      if (requireAuth) {
        const currentPath = window.location.pathname
        localStorage.setItem('redirectAfterLogin', currentPath)
        toast.error('请先登录')
        router.push('/login')
      }
      return
    }

    try {
      const parsedUser = JSON.parse(userData)
      setUser(parsedUser)
    } catch (error) {
      console.error('Failed to parse user data:', error)
      // 安全修复: 使用clearAuthToken清除所有认证信息
      clearAuthToken()
      if (requireAuth) {
        toast.error('登录状态异常，请重新登录')
        router.push('/login')
      }
    } finally {
      setIsLoading(false)
    }
  }, [requireAuth, router])

  const logout = () => {
    // 安全修复: 同时清除localStorage和Cookie
    clearAuthToken()
    setUser(null)
    toast.success('已退出登录')
    router.push('/')
  }

  const checkAuth = (redirectPath?: string): boolean => {
    const token = localStorage.getItem('token')
    if (!token) {
      if (redirectPath) {
        localStorage.setItem('redirectAfterLogin', redirectPath)
      }
      toast.error('请先登录')
      router.push('/login')
      return false
    }
    return true
  }

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    logout,
    checkAuth
  }
}
