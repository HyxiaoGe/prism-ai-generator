/**
 * Toast Hook
 * 提供显示 Toast 通知的方法
 */

import { useState, useCallback } from 'react';
import { ToastType, ToastProps } from '../components/ui/Toast';

let toastId = 0;

export function useToast() {
  const [toasts, setToasts] = useState<ToastProps[]>([]);

  const showToast = useCallback((
    type: ToastType,
    message: string,
    description?: string,
    duration?: number
  ) => {
    const id = `toast-${toastId++}`;
    const newToast: ToastProps = {
      id,
      type,
      message,
      description,
      duration,
      onClose: (id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }
    };

    setToasts((prev) => [...prev, newToast]);
  }, []);

  const success = useCallback((message: string, description?: string) => {
    showToast('success', message, description);
  }, [showToast]);

  const error = useCallback((message: string, description?: string) => {
    showToast('error', message, description, 4000);
  }, [showToast]);

  const warning = useCallback((message: string, description?: string) => {
    showToast('warning', message, description);
  }, [showToast]);

  const info = useCallback((message: string, description?: string) => {
    showToast('info', message, description);
  }, [showToast]);

  const close = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return {
    toasts,
    success,
    error,
    warning,
    info,
    close
  };
}
