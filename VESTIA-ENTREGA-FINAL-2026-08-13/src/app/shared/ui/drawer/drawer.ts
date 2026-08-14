import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-drawer',
  templateUrl: './drawer.html',
  styleUrl: './drawer.css',
})
export class DrawerComponent {
  @Input() open = false;
  @Output() readonly closed = new EventEmitter<void>();
}
