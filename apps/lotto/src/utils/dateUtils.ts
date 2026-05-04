// Date formatting utilities for lotto app
// Safely format dates and handle invalid/missing values

export function formatThaiDateTime(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';
    
    return date.toLocaleString('th-TH', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: 'Asia/Bangkok'
    });
  } catch (error) {
    console.error('[Date Format Error]', error);
    return '-';
  }
}

export function formatThaiDate(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';
    
    return date.toLocaleDateString('th-TH', {
      timeZone: 'Asia/Bangkok'
    });
  } catch (error) {
    console.error('[Date Format Error]', error);
    return '-';
  }
}

export function isDatePassed(dateString: string | null | undefined): boolean {
  if (!dateString) return true; // Treat missing date as passed for safety
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return true; // Invalid date = treat as passed
    
    return date.getTime() < Date.now();
  } catch (error) {
    console.error('[Date Check Error]', error);
    return true; // On error, treat as passed for safety
  }
}

export function isDrawOpen(draw: any): boolean {
  if (!draw) return false;
  if (draw.status !== 'OPEN') return false;
  if (isDatePassed(draw.close_at)) return false;
  return true;
}
