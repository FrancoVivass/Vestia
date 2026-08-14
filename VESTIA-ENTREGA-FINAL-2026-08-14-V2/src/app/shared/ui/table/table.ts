import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-table',
  templateUrl: './table.html',
  styleUrl: './table.css',
})
export class TableComponent {
  @Input() headers: string[] = [];
  @Input() rows: string[][] = [];
}
