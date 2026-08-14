import { Component, HostListener, signal } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

interface NavItem {
  label: string;
  href: string;
}

@Component({
  selector: 'app-public-layout',
  imports: [RouterOutlet, RouterLink],
  templateUrl: './public-layout.html',
  styleUrl: './public-layout.css',
})
export class PublicLayoutComponent {
  readonly scrolled = signal(false);
  readonly mobileMenuOpen = signal(false);
  readonly navItems: NavItem[] = [
    { label: 'Inicio', href: '#inicio' },
    { label: 'Funciones', href: '#funciones' },
    { label: 'Beneficios', href: '#beneficios' },
    { label: 'Características', href: '#caracteristicas' },
    { label: 'Contacto', href: '#contacto' },
  ];

  @HostListener('window:scroll')
  onWindowScroll(): void {
    this.scrolled.set(window.scrollY > 12);
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update((value) => !value);
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }
}
