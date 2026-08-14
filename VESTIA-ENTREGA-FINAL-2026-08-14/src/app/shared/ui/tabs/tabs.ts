import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-tabs',
  templateUrl: './tabs.html',
  styleUrl: './tabs.css',
})
export class TabsComponent {
  @Input() items: string[] = [];
}
