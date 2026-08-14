import { Component } from '@angular/core';
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
export class LandingPageComponent {
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
}
