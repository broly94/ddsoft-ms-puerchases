import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { ProviderBillingType } from './provider-billing-type.entity';
import { ProductBillingAssignment } from './product-billing-assignment.entity';

/**
 * Snapshot de los % con los que se facturó una orden. Se guarda entero en
 * purchases_providers.ultima_facturacion y arranca la próxima orden del proveedor.
 * Ver docs/plan-orden-compra-precios-facturacion.md §5
 */
export interface FacturacionSnapshot {
  /** IVA de la Parte A (Factura). */
  iva_a_pct: number;
  /** Percepciones aplicadas a la Parte A (se suman al iva_a_pct). */
  percep_iva: { activo: boolean; pct: number | null };
  percep_iibb_bsas: { activo: boolean; pct: number | null };
  percep_iibb_caba: { activo: boolean; pct: number | null };
  /** Excepción: la Parte B (Remito) normalmente va sin IVA. */
  iva_b_activo: boolean;
  iva_b_pct: number | null;
}

@Entity('purchases_providers')
export class PurchasesProvider {
  @PrimaryGeneratedColumn()
  id_provider: number;

  /** Código del proveedor en Gescom (cross-DB ref, sin FK). Puede ser numérico con ceros: "00123". */
  @Column({ length: 50, unique: true })
  cod_proveedor: string;

  /** Razón social traída de Gescom al momento de registrar el proveedor. */
  @Column({ length: 255, nullable: true })
  razon_social: string;

  @Column({ type: 'boolean', default: false })
  acepta_devoluciones: boolean;

  /** ¿Trabaja con caja (pago en efectivo)? */
  @Column({ type: 'boolean', default: false })
  trabaja_con_caja: boolean;

  /** Compra mínima en pallets por orden de compra. */
  @Column({ type: 'int', nullable: true })
  pallets_minimos: number;

  /** Capacidad del camión del proveedor en pallets. */
  @Column({ type: 'int', nullable: true })
  pallets_camion: number;

  /** Modos de pago aceptados: efectivo, transferencia, cheque, deposito */
  @Column({ type: 'simple-array', nullable: true })
  modos_pago: string[];

  /** ¿Maneja pronto pago? */
  @Column({ type: 'boolean', default: false })
  pronto_pago: boolean;

  /** Porcentaje de descuento por pronto pago. Null si no aplica. */
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  pronto_pago_pct: number;

  /** ¿Acepta decomiso de mercadería? */
  @Column({ type: 'boolean', default: false })
  acepta_decomiso: boolean;

  /** Tipo de decomiso: 'con_autorizacion' | 'sin_autorizacion'. Null si no acepta decomiso. */
  @Column({ length: 20, nullable: true })
  tipo_decomiso: string;

  /** Plazo de pago en días para la Parte A (ej: 30). */
  @Column({ type: 'int', nullable: true })
  plazo_pago_a_dias: number;

  /** Plazo de pago en días para la Parte B (ej: 0 = contra entrega, 7, etc.). */
  @Column({ type: 'int', nullable: true })
  plazo_pago_b_dias: number;

  /** Objetivo comercial del proveedor en %. 0 = sin objetivo. */
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  objetivo: number;

  @Column({ type: 'text', nullable: true })
  observaciones: string;

  // ── Memoria de la última facturación ─────────────────────────────────────
  // REGISTRO HISTÓRICO INMUTABLE: "así facturó realmente la última vez".
  // Es el default con el que arranca la próxima orden del proveedor
  // (cascada: proveedor.ultima_facturacion → purchases_config → hardcode).
  // Los cambios de config NO se propagan acá — eso convertiría el campo en mentira
  // y rompe la auditoría. Lo resuelve el selector de origen + diff en la orden.
  // Se escribe SOLO al confirmar una orden (confirmOrder), nunca a mano.

  /** Snapshot de los % de la última orden confirmada. Null = sin histórico → usa config. */
  @Column({ type: 'jsonb', nullable: true })
  ultima_facturacion: FacturacionSnapshot | null;

  /** Orden que generó el snapshot (sin FK: si se borra, el hecho histórico sigue valiendo). */
  @Column({ type: 'int', nullable: true })
  ultima_facturacion_orden_id: number | null;

  @Column({ type: 'timestamp', nullable: true })
  ultima_facturacion_fecha: Date | null;

  @Column({ nullable: true })
  created_by: number;

  @Column({ nullable: true })
  updated_by: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updated_at: Date;

  @OneToMany(() => ProviderBillingType, (pbt) => pbt.provider, { cascade: true })
  billing_types: ProviderBillingType[];

  @OneToMany(() => ProductBillingAssignment, (pba) => pba.provider)
  product_assignments: ProductBillingAssignment[];
}
