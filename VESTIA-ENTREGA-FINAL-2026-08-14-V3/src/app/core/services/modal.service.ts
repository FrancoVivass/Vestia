import { Injectable, signal } from '@angular/core';

export interface ModalState {
  open: boolean;
  title?: string;
  description?: string;
  loading?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
}

@Injectable({
  providedIn: 'root',
})
export class ModalService {
  readonly state = signal<ModalState>({ open: false });

  open(config: Omit<ModalState, 'open'> = {}): void {
    this.state.set({
      open: true,
      cancelLabel: 'Cancelar',
      confirmLabel: 'Confirmar',
      ...config,
    });
  }

  close(): void {
    this.state.set({ open: false });
  }
}
