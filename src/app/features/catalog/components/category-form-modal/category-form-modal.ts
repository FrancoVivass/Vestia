import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Category } from '../../../../core/models/category.model';
import { ModalComponent } from '../../../../shared/ui/modal/modal';

@Component({
  selector: 'app-category-form-modal',
  imports: [ReactiveFormsModule, ModalComponent],
  templateUrl: './category-form-modal.html',
  styleUrl: './category-form-modal.css',
})
export class CategoryFormModalComponent {
  private readonly fb = inject(FormBuilder);

  @Input() open = false;
  @Input() category: Category | null = null;
  @Output() readonly closed = new EventEmitter<void>();
  @Output() readonly saved = new EventEmitter<{ name: string; description: string }>();

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    description: [''],
  });

  ngOnChanges(): void {
    this.form.reset({
      name: this.category?.name ?? '',
      description: this.category?.description ?? '',
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
