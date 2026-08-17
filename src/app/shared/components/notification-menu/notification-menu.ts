import { Component, ElementRef, HostListener, inject, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { NotificationService, Notification } from '../../../core/services/notification.service';

@Component({
  selector: 'app-notification-menu',
  imports: [DatePipe],
  templateUrl: './notification-menu.html',
  styleUrl: './notification-menu.css',
})
export class NotificationMenuComponent implements OnInit {
  readonly notifications = inject(NotificationService);
  private readonly el = inject(ElementRef);
  open = false;

  ngOnInit(): void {
    void this.notifications.load();
  }

  toggle(): void {
    this.open = !this.open;
  }

  close(): void {
    this.open = false;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.el.nativeElement.contains(event.target)) {
      this.close();
    }
  }

  markRead(id: string, event: MouseEvent): void {
    event.stopPropagation();
    void this.notifications.markRead(id);
  }

  markAllRead(): void {
    void this.notifications.markAllRead();
  }

  iconFor(type: string): string {
    switch (type) {
      case 'sale': return '💰';
      case 'cash': return '🏦';
      case 'stock': return '📦';
      case 'alert': return '⚠️';
      default: return 'ℹ️';
    }
  }

  trackById(_index: number, item: Notification): string {
    return item.id;
  }
}
