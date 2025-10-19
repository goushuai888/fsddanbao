import { FormDialog } from '@/components/admin/FormDialog'

interface RefundDialogProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (reason: string) => void | Promise<void>
  loading?: boolean
}

export function RefundDialog({ isOpen, onClose, onSubmit, loading }: RefundDialogProps) {
  return (
    <FormDialog
      open={isOpen}
      onOpenChange={onClose}
      title="申请退款"
      loading={loading}
      simpleMode={{
        enabled: true,
        placeholder: "请说明退款原因...",
        minLength: 5,
        submitText: "提交申请",
        onSubmit
      }}
    />
  )
}

interface RejectRefundDialogProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (reason: string) => void | Promise<void>
  loading?: boolean
}

export function RejectRefundDialog({ isOpen, onClose, onSubmit, loading }: RejectRefundDialogProps) {
  return (
    <FormDialog
      open={isOpen}
      onOpenChange={onClose}
      title="拒绝退款"
      loading={loading}
      simpleMode={{
        enabled: true,
        placeholder: "请说明拒绝退款的理由...\n例如：\n- 买家已收到FSD权限\n- 转移凭证有效\n- 其他原因...",
        minLength: 5,
        submitText: "确认拒绝",
        variant: "destructive",
        warningMessage: "请务必填写拒绝理由，这将记录在订单时间线中",
        onSubmit
      }}
    />
  )
}

interface DisputeDialogProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (description: string) => void | Promise<void>
  loading?: boolean
  isPaidRefundRejected?: boolean
}

export function DisputeDialog({
  isOpen,
  onClose,
  onSubmit,
  loading,
  isPaidRefundRejected
}: DisputeDialogProps) {
  const title = isPaidRefundRejected ? '申请平台介入' : '未收到货申诉'
  const placeholder = isPaidRefundRejected
    ? "请说明您的诉求...\n- 要求平台核实情况后退款\n- 卖家拒绝理由不成立\n- 其他诉求..."
    : "请详细说明情况，例如：\n- 未在Tesla App中收到FSD权限\n- 卖家提供的凭证与实际不符\n- 其他问题..."

  const warningBase = "提交申诉后，订单将进入平台仲裁流程，管理员将介入处理。"
  const warningExtra = isPaidRefundRejected
    ? "平台将核实您的退款申请和卖家的拒绝理由，做出公正裁决。"
    : ""

  return (
    <FormDialog
      open={isOpen}
      onOpenChange={onClose}
      title={title}
      loading={loading}
      simpleMode={{
        enabled: true,
        placeholder,
        minLength: 10,
        submitText: "提交申诉",
        variant: "destructive",
        warningMessage: warningBase + (warningExtra ? " " + warningExtra : ""),
        onSubmit
      }}
    />
  )
}
