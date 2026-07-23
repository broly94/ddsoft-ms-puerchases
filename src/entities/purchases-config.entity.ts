import { Entity, PrimaryColumn, Column } from 'typeorm';

/**
 * Configuración de Compras (singleton, id=1).
 * IVA sobre facturación: iva_general es la alícuota de la parte Factura (Parte A);
 * la parte Remito (Parte B) es 0%. El IVA ponderado de un pedido = (pct_a/100) × iva_general.
 *
 * Percepciones: cada una tiene su % y su flag de activación (el check que se prende
 * cuando avisa el contador). La config es el DEFAULT con el que arranca una orden nueva;
 * la orden SIEMPRE puede pisarlo desde su apartado de Facturación.
 * Toda percepción activa se suma al ponderado del PRECIO DE COSTO y al 21% de la
 * Parte A en FACTURACIÓN. No es doble conteo: son dos lentes distintas
 * ("cuánto me cuesta" vs "qué me factura el proveedor").
 * Ver docs/plan-orden-compra-precios-facturacion.md
 *
 * iva_producto_overrides: reservado para la orden de pago (IVA por rubro), no se usa acá.
 */
@Entity('purchases_config')
export class PurchasesConfig {
  @PrimaryColumn({ type: 'int', default: 1 })
  id: number;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 21 })
  iva_general: number;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 3 })
  percep_iva: number;

  @Column({ type: 'boolean', default: false })
  percep_iva_activo: boolean;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 3 })
  percep_iibb_bsas: number;

  @Column({ type: 'boolean', default: false })
  percep_iibb_bsas_activo: boolean;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
  percep_iibb_caba: number;

  @Column({ type: 'boolean', default: false })
  percep_iibb_caba_activo: boolean;

  /**
   * Política de permisos de órdenes: 'todos' | 'creador_mod_admin' | 'mod_admin' | 'admin'.
   * admin/supervisor siempre pueden; 'creador' = created_by === user.id.
   * Editar aplica sólo a órdenes NO borrador. Ver docs/plan-orden-compra-permisos.md
   */
  @Column({ type: 'varchar', length: 20, default: 'creador_mod_admin' })
  orden_edit_policy: string;

  @Column({ type: 'varchar', length: 20, default: 'mod_admin' })
  orden_delete_policy: string;

  /** Fuente del costo de los productos: 'erp' (Gescom) | 'lista' (lista por proveedor). */
  @Column({ type: 'varchar', length: 10, default: 'erp' })
  costo_source: string;

  /**
   * Relleno de faltantes al cargar lista nueva: qué costo nuevo poner a los productos
   * que el proveedor NO incluyó en la lista nueva (no aumentaron). Amortiza el salto futuro.
   * 'actual' = dejar el actual · 'pct' = actual×(1+%/100) · 'promedio' = promedio entre actual y actual×(1+%/100).
   * gap_fill_pct es el % que usan 'pct' y 'promedio'. Default en la config; editable en el modal.
   */
  @Column({ type: 'varchar', length: 10, default: 'actual' })
  gap_fill_strategy: string;

  @Column({ type: 'numeric', precision: 6, scale: 2, default: 0 })
  gap_fill_pct: number;

  // ── Punto de Pedido (settings globales, antes vivían en el store del front) ──
  /** Días de cobertura deseados por default (fallback cuando el proveedor no tiene promedio). */
  @Column({ type: 'int', default: 45 })
  pdp_cobertura_dias: number;

  /** % de vida útil que se puede cubrir con la compra sugerida. */
  @Column({ type: 'numeric', precision: 6, scale: 2, default: 80 })
  pdp_porcentaje_vida_util: number;

  /** Margen de días para el cálculo de sobre stock. */
  @Column({ type: 'int', default: 0 })
  pdp_margen_sobre_stock: number;

  /** ¿Contemplar promociones en la sugerencia? */
  @Column({ type: 'boolean', default: false })
  pdp_contemplar_promociones: boolean;

  /** ¿Multiplicar × 2 el promedio de entrega del proveedor al usarlo como cobertura? */
  @Column({ type: 'boolean', default: true })
  pdp_promedio_x2: boolean;

  @Column({ type: 'boolean', default: true })
  multiplo_activo: boolean;

  @Column({ type: 'int', default: 10 })
  multiplo_bultos: number;

  /** Reservado para la orden de pago: [{ rubro, rate }]. No se usa en la orden de compra. */
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  iva_producto_overrides: { rubro: string; rate: number }[];

  @Column({ type: 'int', nullable: true })
  updated_by: number | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updated_at: Date;
}
