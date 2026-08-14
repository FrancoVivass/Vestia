import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-checkbox',
  templateUrl: './checkbox.html',
  styleUrl: './checkbox.css',
})
export class CheckboxComponent {
  @Input() label = 'Opción';
  @Input() checked = false;
}
