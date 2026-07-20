import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { TipoPago } from './tipo-pago.entity';
import { OrdenCompraItem } from './orden-compra-item.entity';
import { OrdenCompraCambio } from './orden-compra-cambio.entity';

@Entity('orden_compra_header')
export class OrdenCompraHeader {
  @PrimaryGeneratedColumn()
  id_orden_compra: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  fecha_pedido: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  motivo_pedido: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  tipo_facturacion: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  cantidad_pallets: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  razon_social: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  cod_proveedor: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  marca: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  plazo_pago: string;

  @Column({ nullable: true })
  id_tipo_pago: number;

  @ManyToOne(() => TipoPago, (tipoPago) => tipoPago.ordenes_compra, { nullable: true })
  @JoinColumn({ name: 'id_tipo_pago' })
  tipo_pago: TipoPago;

  // IDs separados por coma: "1,3" — reemplaza id_tipo_pago para multi-selección
  @Column({ type: 'varchar', length: 255, nullable: true })
  tipo_pago_ids: string;

  @Column({ type: 'decimal', precision: 18, scale: 2, nullable: true })
  monto: number;

  /**
   * Override manual y TEMPORAL del monto final (Total Facturado). Se carga a mano
   * (el usuario lo saca con Excel) mientras faltan los descuentos estáticos/dinámicos.
   * Si != null, PISA el monto calculado en montoFacturado(). Gateado en el front por
   * MONTO_MANUAL_ENABLED. Quitar cuando la valorización esté completa.
   */
  @Column({ type: 'decimal', precision: 18, scale: 2, nullable: true })
  monto_manual: number | null;

  @Column({ type: 'text', nullable: true })
  nota: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  comprador: string;

  @Column({ type: 'date', nullable: true })
  fecha_turno: Date | null;

  // pendiente | turnado  (entregado/no_entregado viven en turnos.estado)
  @Column({ type: 'varchar', length: 20, default: 'pendiente' })
  estado: string;

  // Plazos de pago estructurados (días, de la config del proveedor)
  @Column({ nullable: true })
  plazo_pago_a_dias: number | null;

  @Column({ nullable: true })
  plazo_pago_b_dias: number | null;

  // Pronto pago
  @Column({ type: 'boolean', default: false })
  pronto_pago: boolean;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  pronto_pago_pct: number | null;

  /** Base del descuento de pronto pago: 'neto' | 'total' (default 'total' c/IVA). */
  @Column({ type: 'varchar', length: 10, nullable: true })
  pronto_pago_base: string | null;

  // Tipo de facturación estructurado (FK a billing_types)
  @Column({ nullable: true })
  billing_type_id: number | null;

  // Momento de pago por parte (anticipado | contra_entrega | null)
  @Column({ type: 'varchar', length: 20, nullable: true })
  momento_a: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  momento_b: string | null;

  // Modos de pago por parte (IDs separados por coma)
  @Column({ type: 'varchar', length: 255, nullable: true })
  modo_pago_a_ids: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  modo_pago_b_ids: string | null;

  @Column({ nullable: true })
  turno_id: number | null;

  // Pedido genérico de carga manual (faltantes de proveedor). Se puede turnar
  // pero queda excluido del promedio de entrega del proveedor.
  @Column({ type: 'boolean', default: false })
  es_generico: boolean;

  // ── Paso 1 del wizard (respuestas de las preguntas iniciales) ──
  /** ¿Pedido habitual o cambio de precio? 'habitual' | 'cambio_precio'. */
  @Column({ type: 'varchar', length: 20, nullable: true })
  tipo_pedido: string | null;

  /** ¿Precio actual o nuevo? 'actual' | 'nuevo'. (Impacto en precios: diferido.) */
  @Column({ type: 'varchar', length: 20, nullable: true })
  precio_tipo: string | null;

  /** ¿Tiene cambios/devoluciones? (solo si el proveedor acepta_devoluciones). */
  @Column({ type: 'boolean', default: false })
  tiene_cambios: boolean;

  /** ¿Se solicitan cajas? (solo si el proveedor trabaja_con_caja). */
  @Column({ type: 'boolean', default: false })
  solicita_cajas: boolean;

  /** Cantidad de cajas solicitadas (si solicita_cajas). */
  @Column({ type: 'int', nullable: true })
  cantidad_cajas: number | null;

  // ── Facturación (Parte A / Parte B) ──────────────────────────────────────
  // Los % se aplican al VALORIZADO FINAL de cada parte, NO producto por producto:
  //   Parte A (Factura) = neto × pct_a/100 × (1 + (iva_a_pct + Σ percep. activas)/100)
  //   Parte B (Remito)  = neto × pct_b/100 × (1 + (iva_b_activo ? iva_b_pct : 0)/100)
  // El ponderado (pct_a/100 × iva_general) NO juega acá: ese es para el precio de costo.
  // Se snapshotean en el header (no se recalculan desde config) para que una orden
  // vieja conserve las alícuotas con las que se armó.
  // Ver docs/plan-orden-compra-precios-facturacion.md

  /** IVA de la Parte A (Factura). Default de config.iva_general, editable por orden. */
  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  iva_a_pct: number | null;

  /** Percepciones aplicadas a la Parte A: se SUMAN al iva_a_pct. */
  @Column({ type: 'boolean', default: false })
  percep_iva_activo: boolean;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  percep_iva_pct: number | null;

  @Column({ type: 'boolean', default: false })
  percep_iibb_bsas_activo: boolean;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  percep_iibb_bsas_pct: number | null;

  @Column({ type: 'boolean', default: false })
  percep_iibb_caba_activo: boolean;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  percep_iibb_caba_pct: number | null;

  /** Parte B normalmente va sin IVA. Excepción: el proveedor pone un %. */
  @Column({ type: 'boolean', default: false })
  iva_b_activo: boolean;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  iva_b_pct: number | null;

  /** De dónde salieron los % de facturación: 'ultimo_pedido' | 'config' | 'manual'. */
  @Column({ type: 'varchar', length: 20, nullable: true })
  facturacion_origen: string | null;

  // Líneas de detalle de productos. Una orden = una condición de facturación (billing_type_id).
  @OneToMany(() => OrdenCompraItem, (item) => item.orden_compra, { cascade: true })
  items: OrdenCompraItem[];

  // Cambios / devoluciones asociados a la orden (Paso 1 del wizard).
  @OneToMany(() => OrdenCompraCambio, (cambio) => cambio.orden_compra, { cascade: true })
  cambios: OrdenCompraCambio[];

  @Column({ nullable: true })
  created_by: number;

  @Column({ nullable: true })
  updated_by: number;

  /**
   * Cuándo se editó la orden DESPUÉS de confirmarse (estado ≠ borrador al guardar).
   * null = nunca se editó tras el alta. Ver getEditStamp / saveOrderItems / updateOrder.
   */
  @Column({ type: 'timestamp', nullable: true })
  fecha_ultima_edicion: Date | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  // OJO: usar @UpdateDateColumn, NO @Column con onUpdate. En Postgres TypeORM IGNORA
  // `onUpdate: CURRENT_TIMESTAMP` (es de MySQL) → updated_at quedaba fijo al valor del
  // alta y "¿se editó la orden?" daba siempre que no. @UpdateDateColumn lo setea TypeORM
  // en cada save() del header (updateOrder, saveOrderItems, saveOrderCambios, confirmOrder).
  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;
  }
