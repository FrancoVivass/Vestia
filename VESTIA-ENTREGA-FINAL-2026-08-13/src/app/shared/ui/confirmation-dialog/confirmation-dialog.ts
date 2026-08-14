import { Component, HostListener, inject } from '@angular/core';
import { ModalService } from '../../../core/services/modal.service';
import { ModalComponent } from '../modal/modal';

@Component({
  selector: 'app-confirmation-dialog',
  imports: [ModalComponent],
  templateUrl: './confirmation-dialog.html',
  styleUrl: './confirmation-dialog.css',
})
export class ConfirmationDialogComponent {
  protected readonly modal = inject(ModalService);

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.modal.state().open) {
      this.modal.close();
    }
  }
}
