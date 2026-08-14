import { Injectable, signal } from '@angular/core';

export type ToastVariant = 'success' | 'warning' | 'danger' | 'info';

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
}

@Injectable({
  providedIn: 'root',
})
export class ToastService {
  readonly items = signal<ToastItem[]>([]);

  show(toast: Omit<ToastItem, 'id'>): void {
    const id = crypto.randomUUID();
    this.items.update((current) => [...current, { ...toast, id }]);

    window.setTimeout(() => {
      this.dismiss(id);
    }, 3200);
  }

  dismiss(id: string): void {
    this.items.update((current) => current.filter((item) => item.id !== id));
  }
}
