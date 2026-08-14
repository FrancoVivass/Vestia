import { AfterViewInit, Component, ElementRef, OnDestroy, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';

interface FeatureItem {
  title: string;
  description: string;
}

interface StockItem {
  product: string;
  quantity: string;
  status: string;
  tone: 'success' | 'warning' | 'danger';
}

interface PosItem {
  product: string;
  quantity: number;
  price: string;
  subtotal: string;
}

@Component({
  selector: 'app-landing-page',
  imports: [RouterLink],
  templateUrl: './landing-page.html',
  styleUrl: './landing-page.css',
})
export class LandingPageComponent implements AfterViewInit, OnDestroy {
  private readonly el = inject(ElementRef);
  private anims: any[] = [];

  readonly features: FeatureItem[] = [
    { title: 'Gestión de productos', description: 'Organizá tu catálogo con datos claros, precios y categorías.' },
    { title: 'Control de stock', description: 'Visualizá existencias, alertas y movimientos con precisión.' },
    { title: 'Punto de venta', description: 'Cobrá rápido y registrá ventas desde una sola interfaz.' },
    { title: 'Códigos de barras', description: 'Generá e imprimí identificadores para agilizar operaciones.' },
    { title: 'Tickets', description: 'Prepará comprobantes claros y ordenados para cada venta.' },
    { title: 'Clientes', description: 'Centralizá datos, historial y seguimiento comercial.' },
    { title: 'Proveedores', description: 'Mantené control sobre compras, contactos y abastecimiento.' },
    { title: 'Caja', description: 'Supervisá ingresos, egresos y cierres diarios.' },
    { title: 'Reportes', description: 'Tomá decisiones con métricas visuales y resúmenes clave.' },
    { title: 'Usuarios', description: 'Administrá accesos y roles para cada persona del equipo.' },
  ];

  readonly stockItems: StockItem[] = [
    { product: 'Camisa Lino Beige', quantity: '42 u.', status: 'En stock', tone: 'success' },
    { product: 'Pantalón Sastrero', quantity: '7 u.', status: 'Stock bajo', tone: 'warning' },
    { product: 'Blazer Marrón', quantity: '0 u.', status: 'Sin stock', tone: 'danger' },
    { product: 'Remera Premium', quantity: '18 u.', status: 'Estable', tone: 'success' },
  ];

  readonly posItems: PosItem[] = [
    { product: 'Vestido Midi Arena', quantity: 1, price: '$ 58.000', subtotal: '$ 58.000' },
    { product: 'Campera Siena', quantity: 2, price: '$ 42.500', subtotal: '$ 85.000' },
    { product: 'Cartera Taupe', quantity: 1, price: '$ 31.000', subtotal: '$ 31.000' },
  ];

  constructor(
    private readonly title: Title,
    private readonly meta: Meta
  ) {
    this.title.setTitle('VESTIA — Gestión inteligente para tu comercio');
    this.meta.updateTag({
      name: 'description',
      content:
        'VESTIA es una plataforma integral para administrar productos, stock, ventas, caja y mucho más.',
    });
  }

  getFeatureIcon(title: string): string {
    const icons: Record<string, string> = {
      'Gestión de productos': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>',
      'Control de stock': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>',
      'Punto de venta': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="9" y1="18" x2="15" y2="18"></line><line x1="10" y1="22" x2="14" y2="22"></line><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"></path></svg>',
      'Códigos de barras': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><rect x="7" y="10" width="2" height="8"></rect><rect x="11" y="10" width="2" height="8"></rect><rect x="15" y="10" width="2" height="8"></rect></svg>',
      'Tickets': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>',
      'Clientes': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>',
      'Proveedores': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>',
      'Caja': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line></svg>',
      'Reportes': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>',
      'Usuarios': '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>',
    };
    return icons[title] || '';
  }

  async ngAfterViewInit(): Promise<void> {
    const lottie = await import('lottie-web');
    const container = this.el.nativeElement;
    const animations = [
      { id: 'funciones-lottie', path: 'assets/funciones.json' },
      { id: 'beneficios-lottie', path: 'assets/beneficios.json' },
      { id: 'caracteristicas-lottie', path: 'assets/caracteristicas.json' },
      { id: 'contacto-lottie', path: 'assets/contacto.json' },
    ];
    for (const a of animations) {
      const el = container.querySelector(`#${a.id}`);
      if (el) {
        this.anims.push(
          lottie.default.loadAnimation({
            container: el,
            renderer: 'svg',
            loop: true,
            autoplay: true,
            path: a.path,
          })
        );
      }
    }
  }

  ngOnDestroy(): void {
    this.anims.forEach(a => a.destroy());
  }

  onContactSubmit(event: Event): void {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const data = new FormData(form);
    const name = data.get('name') || '';
    const email = data.get('email') || '';
    const message = data.get('message') || '';
    const subject = encodeURIComponent(`Consulta de ${name} - VESTIA`);
    const body = encodeURIComponent(`Nombre: ${name}\nEmail: ${email}\n\nMensaje:\n${message}`);
    window.location.href = `mailto:francovivasa@gmail.com?subject=${subject}&body=${body}`;
    form.reset();
  }
}
