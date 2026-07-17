import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { OrdenCompraHeader } from './orden-compra-header.entity';

/**
 * Cambio / devolución asociado a una orden de compra (Paso 1 del wizard).
 * Solo aplica si el proveedor acepta devoluciones y el usuario respondió
 * "¿Tiene cambios? = sí". Guarda el uxb como snapshot para saber a cuántos
 * bultos equivale la cantidad de unidades.
 * cod_articulo es varchar porque los códigos de Gescom pueden tener ceros
 * a la izquierda ("000212").
 */
@Entity('orden_compra_cambios')
export class OrdenCompraCambio {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  orden_compra_id: number;

  @ManyToOne(() => OrdenCompraHeader, (h) => h.cambios, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orden_compra_id' })
  orden_compra: OrdenCompraHeader;

  /** Código del artículo en Gescom (varchar, puede ser "000212"). */
  @Column({ length: 50 })
  cod_articulo: string;

  /** Snapshot de la descripción del artículo. */
  @Column({ type: 'varchar', length: 255, nullable: true })
  descripcion: string | null;

  /** Cantidad de unidades de cambio/devolución. */
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  cantidad_unidades: number;

  /** Unidades por bulto (snapshot; default 1). */
  @Column({ type: 'int', default: 1 })
  uxb: number;

  /** Tipo de movimiento: 'cambio' | 'devolucion'. */
  @Column({ type: 'varchar', length: 20, default: 'cambio' })
  tipo: string;

  /** Motivo del cambio/devolución (texto libre). Vacío = se completa a mano en el PDF. */
  @Column({ type: 'varchar', length: 255, nullable: true })
  motivo: string | null;

  // ── Snapshot de costo + condición para el valorizado de la devolución ──
  // El valorizado respeta el tipo de facturación de CADA producto (un cambio puede
  // mezclar 60/40 y 50/50) → se agrupa por condición. Ver docs/plan-orden-compra-devoluciones-pdf.md

  /** Costo unitario NETO (snapshot de Gescom Precio_Costo_SDesc). */
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  precio_costo: number;

  @Column({ type: 'int', nullable: true })
  billing_type_id: number | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  pct_a: number | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  pct_b: number | null;

  /** Nombre de la condición (ej. "60/40"), para agrupar sin re-consultar. */
  @Column({ type: 'varchar', length: 255, nullable: true })
  tipo_facturacion: string | null;

  @Column({ nullable: true })
  created_by: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;
}
