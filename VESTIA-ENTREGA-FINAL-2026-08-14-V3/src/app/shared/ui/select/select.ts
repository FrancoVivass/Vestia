import { Component, Input } from '@angular/core';

export interface SelectOption {
  label: string;
  value: string;
}

@Component({
  selector: 'app-select',
  templateUrl: './select.html',
  styleUrl: './select.css',
})
export class SelectComponent {
  @Input() label = 'Seleccionar';
  @Input() options: SelectOption[] = [];
}
