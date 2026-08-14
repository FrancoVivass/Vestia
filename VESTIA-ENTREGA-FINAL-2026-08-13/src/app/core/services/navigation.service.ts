import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class NavigationService {
  readonly sidebarOpen = signal(false);

  openSidebar(): void {
    this.sidebarOpen.set(true);
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  toggleSidebar(): void {
    this.sidebarOpen.update((value) => !value);
  }
}
