import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-loading-state',
  templateUrl: './loading-state.html',
  styleUrl: './loading-state.css',
})
export class LoadingStateComponent {
  @Input() label = 'Cargando...';
}
