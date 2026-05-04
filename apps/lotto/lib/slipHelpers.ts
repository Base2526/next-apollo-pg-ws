// Shared helpers for slip status and mutations

export const STATUS_LABELS: Record<string, string> = {
  pending: "รอตรวจ",
  won: "ถูกรางวัล",
  lost: "ไม่ถูกรางวัล",
  cancelled: "ยกเลิก",
  approved: "รับโพยแล้ว",
};

export const STATUS_COLORS: Record<string, string> = {
  pending: "orange",
  won: "green",
  lost: "default",
  cancelled: "red",
  approved: "green",
};

export function getSlipStatusLabel(status: string): string {
  return STATUS_LABELS[status] || status;
}

export function getSlipStatusColor(status: string): string {
  return STATUS_COLORS[status] || 'default';
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
