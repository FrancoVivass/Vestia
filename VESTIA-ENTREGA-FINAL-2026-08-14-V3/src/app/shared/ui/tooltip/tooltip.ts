import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-tooltip',
  templateUrl: './tooltip.html',
  styleUrl: './tooltip.css',
})
export class TooltipComponent {
  @Input() text = 'Tooltip';
  @Input() visible = true;
}
