import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-dropdown',
  templateUrl: './dropdown.html',
  styleUrl: './dropdown.css',
})
export class DropdownComponent {
  @Input() label = 'Opciones';
  @Input() items: string[] = [];
}
