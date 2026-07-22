import { Entity, PrimaryColumn, Column } from 'typeorm';

/**
 * Promedio de entrega por proveedor (indexado por cod_proveedor, independiente de si el
 * proveedor está registrado en purchases_providers). Cubre TODOS los proveedores de Gescom,
 * que es lo que necesita Punto de Pedido para la cobertura por proveedor.
 *
 * El promedio (dias_entrega_promedio) lo calcula y guarda el recálculo (gateway: manual +
 * cronjob) con el cálculo "bolsa única". El override manual + modo los setea el usuario.
 * Cobertura efectiva = modo==='manual' ? dias_entrega_manual : dias_entrega_promedio.
 * Ver docs/plan-promedio-entrega-proveedor.md
 */
@Entity('provider_delivery_stats')
export class ProviderDeliveryStat {
  /** Código del proveedor en Gescom. */
  @PrimaryColumn({ length: 50 })
  cod_proveedor: string;

  /** Promedio de días de entrega calculado. Null = sin datos aún. */
  @Column({ type: 'int', nullable: true })
  dias_entrega_promedio: number | null;

  /** Entregas que cruzaron con órdenes (confianza del promedio). */
  @Column({ type: 'int', default: 0 })
  entregas_cruzadas: number;

  /** Override manual de los días de cobertura para este proveedor. */
  @Column({ type: 'int', nullable: true })
  dias_entrega_manual: number | null;

  /** 'auto' = usa el promedio calculado · 'manual' = usa dias_entrega_manual. */
  @Column({ length: 10, default: 'auto' })
  modo: string;

  /** Última vez que se recalculó el promedio. */
  @Column({ type: 'timestamp', nullable: true })
  actualizado: Date | null;
}
