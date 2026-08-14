import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-skeleton',
  templateUrl: './skeleton.html',
  styleUrl: './skeleton.css',
})
export class SkeletonComponent {
  @Input() lines = 3;
}
