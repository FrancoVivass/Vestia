import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-pagination',
  templateUrl: './pagination.html',
  styleUrl: './pagination.css',
})
export class PaginationComponent {
  @Input() currentPage = 1;
  @Input() totalPages = 1;
}
