import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavigationService } from '../../core/services/navigation.service';
import { ThemeService } from '../../core/services/theme.service';
import { HeaderComponent } from '../../shared/components/header/header';
import { SidebarComponent } from '../../shared/components/sidebar/sidebar';

@Component({
  selector: 'app-dashboard-layout',
  imports: [RouterOutlet, HeaderComponent, SidebarComponent],
  templateUrl: './dashboard-layout.html',
  styleUrl: './dashboard-layout.css',
})
export class DashboardLayoutComponent {
  protected readonly navigation = inject(NavigationService);
  protected readonly theme = inject(ThemeService);
}
