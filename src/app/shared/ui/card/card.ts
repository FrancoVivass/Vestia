import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-card',
  templateUrl: './card.html',
  styleUrl: './card.css',
})
export class CardComponent {
  @Input() title = 'Card';
  @Input() description = '';
}
