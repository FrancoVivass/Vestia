import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Brand } from '../../../../core/models/brand.model';
import { ModalComponent } from '../../../../shared/ui/modal/modal';

@Component({
  selector: 'app-brand-form-modal',
  imports: [ReactiveFormsModule, ModalComponent],
  templateUrl: './brand-form-modal.html',
  styleUrl: './brand-form-modal.css',
})
export class BrandFormModalComponent {
  private readonly fb = inject(FormBuilder);

  @Input() open = false;
  @Input() brand: Brand | null = null;
  @Output() readonly closed = new EventEmitter<void>();
  @Output() readonly saved = new EventEmitter<{ name: string; description: string }>();

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    description: [''],
  });

  ngOnChanges(): void {
    this.form.reset({
      name: this.brand?.name ?? '',
      description: this.brand?.description ?? '',
    });
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saved.emit(this.form.getRawValue());
  }
}
