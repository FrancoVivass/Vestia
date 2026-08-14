import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-input',
  templateUrl: './input.html',
  styleUrl: './input.css',
})
export class InputComponent {
  @Input() label = 'Campo';
  @Input() placeholder = '';
  @Input() type = 'text';
  @Input() value = '';
}
