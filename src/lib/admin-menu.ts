// 后台管理菜单配置
// 添加新功能时，只需在这里添加配置即可

export interface MenuItem {
  id: string
  label: string
  href: string
  icon?: string
  badge?: string
  children?: MenuItem[]
}

export interface MenuGroup {
  id: string
  label: string
  items: MenuItem[]
}

// 管理后台菜单配置
export const adminMenuConfig: MenuGroup[] = [
  {
    id: 'overview',
    label: '概览',
    items: [
      {
        id: 'dashboard',
        label: '数据面板',
        href: '/admin',
        icon: 'LayoutDashboard'
      }
    ]
  },
  {
    id: 'user-management',
    label: '用户管理',
    items: [
      {
        id: 'users',
        label: '用户列表',
        href: '/admin/users',
        icon: 'Users'
      },
      {
        id: 'verification',
        label: '实名认证',
        href: '/admin/verification',
        icon: 'ShieldCheck',
        badge: '开发中'
      }
    ]
  },
  {
    id: 'order-management',
    label: '订单管理',
    items: [
      {
        id: 'orders',
        label: '订单列表',
        href: '/admin/orders',
        icon: 'ShoppingCart'
      },
      {
        id: 'disputes',
        label: '申诉处理',
        href: '/admin/disputes',
        icon: 'AlertTriangle'
      },
      {
        id: 'refunds',
        label: '退款管理',
        href: '/admin/refunds',
        icon: 'RefreshCw'
      }
    ]
  },
  {
    id: 'financial',
    label: '财务管理',
    items: [
      {
        id: 'payments',
        label: '支付记录',
        href: '/admin/payments',
        icon: 'CreditCard'
      },
      {
        id: 'withdrawals',
        label: '提现审核',
        href: '/admin/withdrawals',
        icon: 'Banknote'
      },
      {
        id: 'revenue',
        label: '收益统计',
        href: '/admin/revenue',
        icon: 'TrendingUp'
      }
    ]
  },
  {
    id: 'system',
    label: '系统设置',
    items: [
      {
        id: 'settings',
        label: '平台设置',
        href: '/admin/settings',
        icon: 'Settings',
        badge: '待开发'
      },
      {
        id: 'logs',
        label: '操作日志',
        href: '/admin/logs',
        icon: 'FileText',
        badge: '待开发'
      }
    ]
  }
]

// 根据权限过滤菜单（未来扩展）
export function getMenuByRole(role: string): MenuGroup[] {
  // 目前只有ADMIN可以访问所有菜单
  if (role === 'ADMIN') {
    return adminMenuConfig
  }
  return []
}
