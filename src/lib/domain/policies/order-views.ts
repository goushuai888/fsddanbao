import type { OrderFilterType, OrderStatusFilter } from '@/hooks/useOrders'

/**
 * 订单视图配置
 * 配置驱动设计，集中管理不同视图的行为
 */
export const ORDER_VIEW_CONFIGS = {
  market: {
    label: '市场浏览',
    hideStatus: true,               // 隐藏订单状态标签
    defaultStatus: 'PUBLISHED' as OrderStatusFilter,  // 默认只显示在售订单
    showStatusFilter: false,        // 不显示状态筛选器
    description: '浏览所有在售的FSD转让订单',
    emptyMessage: '暂无在售订单',
    emptyDescription: '目前没有可购买的FSD权限转让订单'
  },
  all: {
    label: '我的全部',
    hideStatus: false,
    defaultStatus: 'all' as OrderStatusFilter,
    showStatusFilter: true,
    description: '查看所有与我相关的订单',
    emptyMessage: '暂无订单',
    emptyDescription: '您还没有参与任何订单'
  },
  sell: {
    label: '我卖出的',
    hideStatus: false,
    defaultStatus: 'all' as OrderStatusFilter,
    showStatusFilter: true,
    description: '查看我发布的卖单',
    emptyMessage: '暂无卖出订单',
    emptyDescription: '您还没有发布任何转让订单'
  },
  buy: {
    label: '我买入的',
    hideStatus: false,
    defaultStatus: 'all' as OrderStatusFilter,
    showStatusFilter: true,
    description: '查看我购买的订单',
    emptyMessage: '暂无买入订单',
    emptyDescription: '您还没有购买任何订单'
  }
} as const

export type OrderViewConfig = typeof ORDER_VIEW_CONFIGS[keyof typeof ORDER_VIEW_CONFIGS]

/**
 * 获取视图配置
 */
export function getViewConfig(filterType: OrderFilterType): OrderViewConfig {
  return ORDER_VIEW_CONFIGS[filterType]
}
