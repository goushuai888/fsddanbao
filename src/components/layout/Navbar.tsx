import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { UserDropdown } from './UserDropdown'

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
              {/* Admin Link */}
              {user.role === 'ADMIN' && (
                <Link href="/admin/users">
                  <Button variant="outline" size="sm">
                    超级管理员
                  </Button>
                </Link>
              )}

              {/* User Dropdown - 整合了个人中心、我的订单、账务记录、退出登录 */}
              <UserDropdown
                userName={user.name || user.email}
                verified={user.verified}
                onLogout={onLogout}
              />
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
