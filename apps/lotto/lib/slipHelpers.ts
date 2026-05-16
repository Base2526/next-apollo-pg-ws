// Shared helpers for slip status and mutations

// Order Status Labels (lotto_orders.status)
export const STATUS_LABELS: Record<string, string> = {
  pending_confirm: "รอยืนยัน",
  approved: "รับโพยแล้ว",
  refunded: "คืนเงินแล้ว",
  rejected: "ปฏิเสธ",
  // Legacy support
  pending: "รอตรวจ",
};

// Result Status Labels (lotto_orders.result_status)
export const RESULT_STATUS_LABELS: Record<string, string> = {
  pending: "รอออกผล",
  won: "ถูกรางวัล",
  lost: "ไม่ถูกรางวัล",
  paid: "จ่ายเงินแล้ว",
  refunded: "คืนเงินแล้ว",
};

export const STATUS_COLORS: Record<string, string> = {
  pending_confirm: "orange",
  approved: "blue",
  refunded: "default",
  rejected: "red",
  won: "green",
  lost: "default",
  paid: "green",
  // Legacy support
  pending: "orange",
  cancelled: "red",
};

export function getSlipStatusLabel(status: string, resultStatus?: string): string {
  // Priority: show order status first if it's meaningful
  if (status === 'pending_confirm') return STATUS_LABELS.pending_confirm;
  if (status === 'refunded') return STATUS_LABELS.refunded;
  if (status === 'rejected') return STATUS_LABELS.rejected;
  if (status === 'approved') {
    // If approved, show result status
    if (resultStatus && RESULT_STATUS_LABELS[resultStatus]) {
      return RESULT_STATUS_LABELS[resultStatus];
    }
    return STATUS_LABELS.approved;
  }
  
  // Fallback to status or result_status
  return STATUS_LABELS[status] || RESULT_STATUS_LABELS[resultStatus || ''] || status;
}

export function getSlipStatusColor(status: string, resultStatus?: string): string {
  // Priority: show order status color first if it's meaningful
  if (status === 'pending_confirm') return STATUS_COLORS.pending_confirm;
  if (status === 'refunded') return STATUS_COLORS.refunded;
  if (status === 'rejected') return STATUS_COLORS.rejected;
  if (status === 'approved') {
    // If approved, show result status color
    if (resultStatus && STATUS_COLORS[resultStatus]) {
      return STATUS_COLORS[resultStatus];
    }
    return STATUS_COLORS.approved;
  }
  
  // Fallback
  return STATUS_COLORS[status] || STATUS_COLORS[resultStatus || ''] || 'default';
}

// Safe date formatter
export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "-";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "-";
    return date.toLocaleString('th-TH', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return "-";
  }
}

// Admin action types for slip management
export type SlipActionType = 
  | 'APPROVE'      // Show "รับโพย" button
  | 'REFUND'       // Show "คืนเงิน" button
  | 'APPROVED'     // Show "รับโพยแล้ว" tag
  | 'REFUNDED'     // Show "คืนเงินแล้ว" tag
  | 'REJECTED'     // Show "ปฏิเสธ" tag
  | 'NONE';        // Show "-"

export interface SlipActionInfo {
  type: SlipActionType;
  label: string;
  color?: string;
  isButton: boolean;
  isDisabled: boolean;
}

/**
 * Determine what action should be shown for an order in admin panel
 * @param status - Order status (pending_confirm, approved, refunded, etc.)
 * @param resultStatus - Result status (pending, won, lost, paid, refunded)
 * @param closeAt - Draw close time (ISO string or null)
 * @returns Action info for rendering
 */
export function getSlipAdminAction(
  status: string | null | undefined,
  resultStatus: string | null | undefined,
  closeAt: string | null | undefined
): SlipActionInfo {
  const now = new Date();
  const closeDate = closeAt ? new Date(closeAt) : null;
  const isExpired = closeDate && now > closeDate;
  const statusValue = status || 'pending';
  const resultStatusValue = resultStatus || 'pending';

  // Check if order is pending confirmation (support old and new status)
  const isPendingConfirm = 
    statusValue === 'pending_confirm' || 
    statusValue === 'pending' || 
    statusValue === 'waiting' ||
    statusValue === 'unchecked' ||
    (statusValue !== 'approved' && 
     statusValue !== 'refunded' && 
     statusValue !== 'rejected' && 
     resultStatusValue === 'pending');

  const isDrawOpen = !closeDate || now < closeDate;

  // Log for debugging
  console.log('[getSlipAdminAction]', {
    status: statusValue,
    resultStatus: resultStatusValue,
    closeAt: closeDate?.toISOString(),
    isPendingConfirm,
    isDrawOpen,
    isExpired,
  });

  // Show "รับโพย" button if pending and draw is still open
  if (isPendingConfirm && isDrawOpen) {
    return {
      type: 'APPROVE',
      label: 'รับโพย',
      isButton: true,
      isDisabled: false,
    };
  }

  // Show "คืนเงิน" button if pending but draw expired
  if (isPendingConfirm && isExpired) {
    return {
      type: 'REFUND',
      label: 'คืนเงิน',
      isButton: true,
      isDisabled: false,
    };
  }

  // Show status indicator for other cases
  if (statusValue === 'approved') {
    return {
      type: 'APPROVED',
      label: 'รับโพยแล้ว',
      color: 'blue',
      isButton: false,
      isDisabled: true,
    };
  }

  if (statusValue === 'refunded') {
    return {
      type: 'REFUNDED',
      label: 'คืนเงินแล้ว',
      color: 'default',
      isButton: false,
      isDisabled: true,
    };
  }

  if (statusValue === 'rejected') {
    return {
      type: 'REJECTED',
      label: 'ปฏิเสธ',
      color: 'red',
      isButton: false,
      isDisabled: true,
    };
  }

  return {
    type: 'NONE',
    label: '-',
    isButton: false,
    isDisabled: true,
  };
}
