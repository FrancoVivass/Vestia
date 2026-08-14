import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-modal',
  templateUrl: './modal.html',
  styleUrl: './modal.css',
})
export class ModalComponent {
  @Input() open = false;
  @Input() title = '';
  @Input() description = '';
  @Input() loading = false;
  @Input() confirmLabel = 'Confirmar';
  @Input() cancelLabel = 'Cancelar';
  @Input() wide = false;
  @Output() readonly closed = new EventEmitter<void>();
  @Output() readonly confirmed = new EventEmitter<void>();

  close(): void {
    if (!this.loading) {
      this.closed.emit();
    }
  }

  confirm(): void {
    if (!this.loading) {
      this.confirmed.emit();
    }
  }
}
