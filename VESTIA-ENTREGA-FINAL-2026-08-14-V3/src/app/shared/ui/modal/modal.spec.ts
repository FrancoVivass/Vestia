import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ModalComponent } from './modal';

@Component({
  imports: [ModalComponent],
  template: `
    <app-modal [open]="true" title="Prueba" description="Contenido proyectado">
      <label>Nombre<input data-testid="projected-input"></label>
    </app-modal>
  `,
})
class ModalHostComponent {}

describe('ModalComponent', () => {
  it('renders the projected form content', async () => {
    await TestBed.configureTestingModule({ imports: [ModalHostComponent] }).compileComponents();
    const fixture = TestBed.createComponent(ModalHostComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="projected-input"]')).toBeTruthy();
  });
});
