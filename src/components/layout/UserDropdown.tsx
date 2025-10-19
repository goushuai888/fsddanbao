'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { User, FileText, Wallet, LogOut, ChevronDown } from 'lucide-react'

interface UserDropdownProps {
  userName: string
  verified?: boolean
  onLogout?: () => void
}

export function UserDropdown({ userName, verified, onLogout }: UserDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // 点击外部关闭下拉菜单
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // ESC键关闭
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  return (
    <div className="relative" ref={dropdownRef}>
      {/* 触发按钮 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <User className="w-4 h-4" />
        <span className="hidden sm:inline">{userName}</span>
        {verified && (
          <span className="text-green-600 text-xs" title="已认证">
            ✓
          </span>
        )}
        <ChevronDown
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* 下拉菜单 */}
      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-md shadow-lg z-50 animate-in fade-in slide-in-from-top-2 duration-200"
          role="menu"
        >
          <div className="py-1">
            {/* 个人中心 */}
            <Link
              href="/profile"
              className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
              onClick={() => setIsOpen(false)}
              role="menuitem"
            >
              <User className="w-4 h-4 text-gray-500" />
              <span>个人中心</span>
            </Link>

            {/* 我的订单 */}
            <Link
              href="/orders"
              className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
              onClick={() => setIsOpen(false)}
              role="menuitem"
            >
              <FileText className="w-4 h-4 text-gray-500" />
              <span>我的订单</span>
            </Link>

            {/* 账务记录 */}
            <Link
              href="/transactions"
              className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
              onClick={() => setIsOpen(false)}
              role="menuitem"
            >
              <Wallet className="w-4 h-4 text-gray-500" />
              <span>账务记录</span>
            </Link>

            {/* 分隔线 */}
            {onLogout && <div className="my-1 border-t border-gray-200" />}

            {/* 退出登录 */}
            {onLogout && (
              <button
                onClick={() => {
                  setIsOpen(false)
                  onLogout()
                }}
                className="flex items-center gap-3 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                role="menuitem"
              >
                <LogOut className="w-4 h-4" />
                <span>退出登录</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
