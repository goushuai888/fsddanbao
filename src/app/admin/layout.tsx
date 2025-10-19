'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { AdminSidebar } from '@/components/admin/AdminSidebar'
import { Menu, X, Home, LogOut } from 'lucide-react'
import { setAuthToken, clearAuthToken } from '@/lib/utils/helpers/cookies'
import { Toaster, toast } from 'sonner'

// 管理员用户类型定义
interface AdminUser {
  id: string
  email: string
  name: string | null
  role: 'ADMIN'
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [user, setUser] = useState<AdminUser | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 检查登录状态和管理员权限
    const token = localStorage.getItem('token')
    const userData = localStorage.getItem('user')

    if (!token || !userData) {
      router.push('/login?redirect=/admin')
      return
    }

    // 安全修复：确保token也保存到Cookie（兼容旧用户）
    // 如果用户是在代码更新前登录的，需要补充设置Cookie
    setAuthToken(token)

    const parsedUser = JSON.parse(userData)
    if (parsedUser.role !== 'ADMIN') {
      toast.error('无权访问管理后台', {
        description: '您需要管理员权限才能访问此页面'
      })
      router.push('/')
      return
    }

    setUser(parsedUser)
    setLoading(false)
  }, [router])

  const handleLogout = () => {
    // 安全修复：同时清除localStorage和Cookie
    clearAuthToken()
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">加载中...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Toast 通知 */}
      <Toaster position="top-right" richColors />

      {/* 顶部导航栏 */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
            >
              {sidebarCollapsed ? <Menu className="w-5 h-5" /> : <X className="w-5 h-5" />}
            </button>

            <Link href="/" className="flex items-center gap-2 text-gray-900 hover:text-gray-600">
              <Home className="w-5 h-5" />
              <span className="font-semibold hidden sm:inline">返回首页</span>
            </Link>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-sm">
              <span className="text-gray-600">管理员：</span>
              <span className="font-medium text-gray-900">{user?.name || user?.email}</span>
            </div>
            <Button
              onClick={handleLogout}
              variant="ghost"
              size="sm"
              className="gap-2"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">退出</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* 侧边栏 */}
        <AdminSidebar collapsed={sidebarCollapsed} />

        {/* 主内容区 */}
        <main className="flex-1 p-6 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  )
}
