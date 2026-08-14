import { Component, computed, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-breadcrumb',
  templateUrl: './breadcrumb.html',
  styleUrl: './breadcrumb.css',
})
export class BreadcrumbComponent {
  private readonly router = inject(Router);

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.router.url),
      startWith(this.router.url)
    ),
    { initialValue: this.router.url }
  );

  readonly title = computed(() => {
    const url = this.currentUrl();

    if (url.includes('/app/admin/comercios')) {
      return 'Comercios';
    }

    if (url.includes('/app/admin')) {
      return 'Panel global';
    }

    return 'Dashboard';
  });
}
