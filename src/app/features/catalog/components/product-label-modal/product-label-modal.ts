import { AfterViewChecked, Component, ElementRef, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import JsBarcode from 'jsbarcode';
import { Product, ProductVariant } from '../../../../core/models/product.model';
import { SupabaseService } from '../../../../core/services/supabase.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ModalComponent } from '../../../../shared/ui/modal/modal';

@Component({selector:'app-product-label-modal',imports:[FormsModule,ModalComponent],templateUrl:'./product-label-modal.html',styleUrl:'./product-label-modal.css'})
export class ProductLabelModalComponent implements OnChanges,AfterViewChecked {
  private readonly host:ElementRef<HTMLElement>=inject(ElementRef);private readonly client=inject(SupabaseService).client;private readonly toast=inject(ToastService);
  @Input() open=false;@Input() product:Product|null=null;@Output() readonly closed=new EventEmitter<void>();
  readonly selected=signal<string[]>([]);readonly settings=signal({width:50,height:30});quantity=1;printing=signal(false);

  async ngOnChanges(changes:SimpleChanges){if((changes['open']?.currentValue===true||changes['product'])&&this.product){this.selected.set(this.product.variants.filter(variant=>variant.status==='active').map(variant=>variant.id));this.quantity=1;const{data}=await this.client.from('app_settings').select('label_settings').maybeSingle();const value=data?.label_settings as{width?:number;height?:number}|null;if(value)this.settings.update(current=>({...current,...value}));this.redraw();}}
  variants(){return this.product?.variants.filter(variant=>this.selected().includes(variant.id))??[];}
  toggle(id:string,checked:boolean){this.selected.update(values=>checked?[...new Set([...values,id])]:values.filter(value=>value!==id));this.redraw();}
  ngAfterViewChecked(){this.host.nativeElement.querySelectorAll<SVGElement>('svg[data-barcode]:not([data-ready])').forEach(svg=>{JsBarcode(svg,svg.dataset['barcode']??'',{format:'CODE128',displayValue:true,height:34,margin:1,fontSize:10});svg.dataset['ready']='1';});}
  redraw(){setTimeout(()=>this.host.nativeElement.querySelectorAll('svg[data-ready]').forEach(element=>element.removeAttribute('data-ready')));}
  copies(){return Array.from({length:Math.max(1,Math.min(100,Number(this.quantity)||1))});}
  variantName(variant:ProductVariant){return`${variant.color||'Sin color'} / ${variant.size||'Sin talle'}`;}

  async print(){if(!this.variants().length){this.toast.show({title:'Seleccioná al menos una variante',variant:'warning'});return;}this.printing.set(true);try{await new Promise(resolve=>setTimeout(resolve,50));const sheet=this.host.nativeElement.querySelector<HTMLElement>('.automatic-label-sheet');if(!sheet)throw new Error('No se pudo preparar la etiqueta');const frame=document.createElement('iframe');frame.style.position='fixed';frame.style.width='0';frame.style.height='0';frame.style.border='0';frame.style.right='0';frame.style.bottom='0';document.body.appendChild(frame);const doc=frame.contentDocument;if(!doc)throw new Error('No se pudo abrir la impresión');doc.open();doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>Etiquetas ${this.product?.name??''}</title><style>@page{size:80mm auto;margin:2mm}*{box-sizing:border-box}body{margin:0;width:76mm;font-family:Arial,sans-serif;color:#000}.sheet{display:flex;flex-direction:column;align-items:center;gap:2mm}.label{width:${this.settings().width}mm;height:${this.settings().height}mm;border:1px dashed #aaa;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:1mm;overflow:hidden;text-align:center;break-inside:avoid}.label strong{font-size:11px}.label span,.label small{font-size:8px}.label b{font-size:11px}.label svg{max-width:96%;max-height:13mm}</style></head><body><div class="sheet">${sheet.innerHTML}</div></body></html>`);doc.close();const{error}=await this.client.rpc('mark_product_labels_printed',{p_variant_ids:this.variants().map(variant=>variant.id)});if(error){frame.remove();throw new Error([error.message,error.details,error.hint,error.code].filter(Boolean).join(' · '));}setTimeout(()=>{frame.contentWindow?.focus();frame.contentWindow?.print();setTimeout(()=>frame.remove(),1000);},100);this.toast.show({title:'Etiquetas listas para la comandera',description:'Elegí tu impresora térmica en el diálogo de impresión.',variant:'success'});}catch(error){this.toast.show({title:'No se pudo imprimir',description:error instanceof Error?error.message:'Error inesperado',variant:'danger'});}finally{this.printing.set(false);}}
}
