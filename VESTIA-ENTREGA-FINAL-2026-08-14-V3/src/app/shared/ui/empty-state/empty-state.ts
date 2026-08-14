import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  templateUrl: './empty-state.html',
  styleUrl: './empty-state.css',
})
export class EmptyStateComponent {
  @Input() title = 'Sin datos';
  @Input() description = '';
}
