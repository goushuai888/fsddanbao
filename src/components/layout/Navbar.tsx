import Link from 'next/link'
import { Button } from '@/components/ui/button'

interface NavbarProps {
  user?: {
    name: string | null
    email: string
    role: string
    verified: boolean
  } | null
  onLogout?: () => void
}

export function Navbar({ user, onLogout }: NavbarProps) {
  return (
    <nav className="bg-white border-b shadow-sm">
      <div className="container mx-auto px-4 py-4">
        <div className="flex justify-between items-center">
          {/* Logo */}
          <Link
            href="/"
            className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent hover:opacity-80 transition-opacity"
          >
            FSD担保交易平台
          </Link>

          {/* Navigation */}
          {user && (
            <div className="flex items-center gap-4">
              {/* User Info */}
              <span className="text-sm text-gray-600">
                欢迎，{user.name || user.email}
                {user.verified && (
                  <span className="ml-1 text-green-600" title="已认证">
                    ✓
                  </span>
                )}
              </span>

              {/* Admin Link */}
              {user.role === 'ADMIN' && (
                <Link href="/admin/users">
                  <Button variant="outline" size="sm">
                    超级管理员
                  </Button>
                </Link>
              )}

              {/* User Links */}
              <Link href="/profile">
                <Button variant="outline" size="sm">
                  个人中心
                </Button>
              </Link>

              <Link href="/orders">
                <Button variant="outline" size="sm">
                  我的订单
                </Button>
              </Link>

              <Link href="/transactions">
                <Button variant="outline" size="sm">
                  账务记录
                </Button>
              </Link>

              {/* Logout Button */}
              {onLogout && (
                <Button
                  onClick={onLogout}
                  variant="ghost"
                  size="sm"
                >
                  退出
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
