import { Component, Input } from '@angular/core';

type BadgeVariant = 'neutral' | 'success' | 'warning' | 'danger';

@Component({
  selector: 'app-badge',
  templateUrl: './badge.html',
  styleUrl: './badge.css',
})
export class BadgeComponent {
  @Input() label = 'Estado';
  @Input() variant: BadgeVariant = 'neutral';

  get classes(): string {
    const variants: Record<BadgeVariant, string> = {
      neutral: 'border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text)]',
      success: 'border-transparent bg-[var(--color-success)]/15 text-[var(--color-success)]',
      warning: 'border-transparent bg-[var(--color-warning)]/15 text-[var(--color-warning)]',
      danger: 'border-transparent bg-[var(--color-danger)]/15 text-[var(--color-danger)]',
    };

    return `inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${variants[this.variant]}`;
  }
}
