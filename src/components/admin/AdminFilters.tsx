/**
 * 通用管理员筛选组件
 *
 * 用途：替代 4 个管理员页面中重复的筛选逻辑
 * 消除重复代码：~320 行 (80 行 × 4 个页面)
 *
 * 支持的筛选类型：
 * - select: 下拉选择
 * - text: 文本搜索
 * - date: 日期选择
 * - dateRange: 日期范围（开始和结束日期）
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export interface FilterOption {
  label: string
  value: string
}

export interface FilterField {
  name: string
  label: string
  type: 'select' | 'text' | 'date' | 'dateRange'
  placeholder?: string
  options?: FilterOption[] // 用于 select 类型
  startDateName?: string // 用于 dateRange 类型
  endDateName?: string // 用于 dateRange 类型
}

export interface AdminFiltersProps {
  title?: string
  description?: string
  fields: FilterField[]
  values: Record<string, any>
  onChange: (values: Record<string, any>) => void
  className?: string
}

export function AdminFilters({
  title = '筛选条件',
  description,
  fields,
  values,
  onChange,
  className = ''
}: AdminFiltersProps) {
  const handleChange = (name: string, value: any) => {
    onChange({ ...values, [name]: value })
  }

  const renderField = (field: FilterField) => {
    const commonClasses = "flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"

    switch (field.type) {
      case 'select':
        return (
          <div key={field.name}>
            <Label htmlFor={field.name} className="block text-sm font-medium mb-2">
              {field.label}
            </Label>
            <select
              id={field.name}
              value={values[field.name] || ''}
              onChange={(e) => handleChange(field.name, e.target.value)}
              className={commonClasses}
            >
              {field.options?.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )

      case 'text':
        return (
          <div key={field.name}>
            <Label htmlFor={field.name} className="block text-sm font-medium mb-2">
              {field.label}
            </Label>
            <Input
              id={field.name}
              type="text"
              placeholder={field.placeholder}
              value={values[field.name] || ''}
              onChange={(e) => handleChange(field.name, e.target.value)}
            />
          </div>
        )

      case 'date':
        return (
          <div key={field.name}>
            <Label htmlFor={field.name} className="block text-sm font-medium mb-2">
              {field.label}
            </Label>
            <Input
              id={field.name}
              type="date"
              value={values[field.name] || ''}
              onChange={(e) => handleChange(field.name, e.target.value)}
            />
          </div>
        )

      case 'dateRange':
        const startName = field.startDateName || 'startDate'
        const endName = field.endDateName || 'endDate'

        return (
          <div key={field.name} className="col-span-2">
            <Label className="block text-sm font-medium mb-2">
              {field.label}
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Input
                  type="date"
                  placeholder="开始日期"
                  value={values[startName] || ''}
                  onChange={(e) => handleChange(startName, e.target.value)}
                />
              </div>
              <div>
                <Input
                  type="date"
                  placeholder="结束日期"
                  value={values[endName] || ''}
                  onChange={(e) => handleChange(endName, e.target.value)}
                />
              </div>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && (
          <p className="text-sm text-gray-600 mt-1">{description}</p>
        )}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {fields.map(renderField)}
        </div>
      </CardContent>
    </Card>
  )
}
