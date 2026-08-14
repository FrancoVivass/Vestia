import { Component, computed, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BusinessService } from '../../../../core/services/business.service';
import { BadgeComponent } from '../../../../shared/ui/badge/badge';
import { CardComponent } from '../../../../shared/ui/card/card';

@Component({
  selector: 'app-admin-home-page',
  imports: [BadgeComponent, CardComponent, RouterLink],
  templateUrl: './admin-home-page.html',
  styleUrl: './admin-home-page.css',
})
export class AdminHomePageComponent implements OnInit {
  private readonly businessService = inject(BusinessService);

  readonly metrics = this.businessService.metrics;
  readonly activity = this.businessService.activity;
  readonly activeBusinesses = computed(() =>
    this.businessService.businesses().filter((business) => business.isActive).slice(0, 5)
  );

  async ngOnInit(): Promise<void> {
    await this.businessService.load();
  }
}
