import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { OrdenCompraHeader } from './orden-compra-header.entity';

/**
 * Línea de detalle de una orden de compra: un artículo de Gescom con su cantidad,
 * condición de facturación (heredada de la orden) y valorizado.
 * Los campos de descripción/precio/split son snapshots al momento del pedido.
 * cod_articulo es varchar porque los códigos de Gescom pueden tener ceros a la izquierda ("000212").
 */
@Entity('orden_compra_items')
@Unique(['orden_compra_id', 'cod_articulo'])
export class OrdenCompraItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  orden_compra_id: number;

  @ManyToOne(() => OrdenCompraHeader, (h) => h.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orden_compra_id' })
  orden_compra: OrdenCompraHeader;

  /** Código del artículo en Gescom (varchar, puede ser "000212"). */
  @Column({ length: 50 })
  cod_articulo: string;

  /** Snapshot de la descripción del artículo. */
  @Column({ type: 'varchar', length: 255, nullable: true })
  descripcion: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  marca: string | null;

  @Column({ type: 'int', nullable: true })
  linea: number | null;

  /** Cantidad PAGADA, en bultos. Lo que se paga y se factura (≠ lo que se recibe). */
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  cantidad_bultos: number;

  // ── Bonificación: "comprando X bultos te dan Y de regalo" ────────────────
  // pagados (cantidad_bultos) + bonif_bultos = RECIBIDOS.
  // Los PALLETS salen de los recibidos (lo gratis ocupa lugar); el valorizado, de
  // los pagados. Ver docs/plan-orden-compra-bonificaciones.md

  /** Bultos que llegan gratis. No se pagan ni se facturan, pero ocupan pallet. */
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  bonif_bultos: number;

  /** Snapshot de la regla aplicada (null si la bonificación se cargó a mano). */
  @Column({ type: 'int', nullable: true })
  bonif_compra: number | null;

  @Column({ type: 'int', nullable: true })
  bonif_bonifica: number | null;

  /** 'proveedor' (regla configurada) | 'manual' (cargada en esta orden). */
  @Column({ type: 'varchar', length: 20, nullable: true })
  bonif_origen: string | null;

  /** La cantidad la calculó la regla; se apaga si el usuario la edita a mano. */
  @Column({ type: 'boolean', default: false })
  ajustado_por_bonif: boolean;

  /** Unidades por bulto de compra (snapshot). */
  @Column({ type: 'int', default: 1 })
  uxb_compra: number;

  /** Bultos por pallet (snapshot; default 1). */
  @Column({ type: 'int', default: 1 })
  bxp: number;

  /** Precio de costo por unidad, sin IVA (snapshot, editable). */
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  precio_costo: number;

  /** Condición de facturación de la línea (= condición de la orden). */
  @Column({ nullable: true })
  billing_type_id: number | null;

  /** Snapshot del split de la condición al momento del pedido. */
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  pct_a: number | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  pct_b: number | null;

  /** Valorizado de la línea (= cantidad_bultos * uxb_compra * precio_costo). */
  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  subtotal: number;

  // ── Snapshots de Punto de Pedido (referencia, opcionales) ──
  @Column({ type: 'decimal', precision: 12, scale: 3, nullable: true })
  venta_diaria_bultos: number | null;

  @Column({ type: 'int', nullable: true })
  compra_sugerida_bultos: number | null;

  @Column({ type: 'int', nullable: true })
  dias_stock_restantes: number | null;

  @Column({ nullable: true })
  created_by: number;

  @Column({ nullable: true })
  updated_by: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updated_at: Date;
}
