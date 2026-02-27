export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
}

export function createToast(message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info', duration = 3000): Toast {
  return {
    id: Date.now().toString(),
    message,
    type,
    duration,
  };
}
