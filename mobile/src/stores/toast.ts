import { create } from 'zustand';

export type ToastKind = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  message?: string;
}

interface ToastState {
  toasts: Toast[];
  show: (toast: Omit<Toast, 'id'>) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToastStore = create<ToastState>()((set) => ({
  toasts: [],
  show: (toast) => set((s) => ({ toasts: [...s.toasts.slice(-2), { ...toast, id: nextId++ }] })),
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  success: (title: string, message?: string) => useToastStore.getState().show({ kind: 'success', title, message }),
  error: (title: string, message?: string) => useToastStore.getState().show({ kind: 'error', title, message }),
  info: (title: string, message?: string) => useToastStore.getState().show({ kind: 'info', title, message }),
};
