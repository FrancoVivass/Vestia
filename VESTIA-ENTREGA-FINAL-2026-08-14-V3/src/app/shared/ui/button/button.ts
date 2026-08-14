import { Component, EventEmitter, Input, Output } from '@angular/core';

type ButtonVariant = 'primary' | 'secondary' | 'danger';

@Component({
  selector: 'app-button',
  templateUrl: './button.html',
  styleUrl: './button.css',
})
export class ButtonComponent {
  @Input() label = 'Acción';
  @Input() type: 'button' | 'submit' = 'button';
  @Input() variant: ButtonVariant = 'primary';
  @Input() disabled = false;
  @Output() readonly buttonClick = new EventEmitter<void>();

  get classes(): string {
    const base = 'inline-flex items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-semibold transition';
    const variants: Record<ButtonVariant, string> = {
      primary: 'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)]',
      secondary: 'border border-[var(--color-border)] bg-white text-[var(--color-text)] hover:border-[var(--color-primary)]',
      danger: 'bg-[var(--color-danger)] text-white hover:opacity-90',
    };

    return `${base} ${variants[this.variant]}`;
  }

  handleClick(): void {
    if (!this.disabled) {
      this.buttonClick.emit();
    }
  }
}
