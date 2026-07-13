import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { TipoPago } from './tipo-pago.entity';
import { OrdenCompraItem } from './orden-compra-item.entity';

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

  // Líneas de detalle de productos. Una orden = una condición de facturación (billing_type_id).
  @OneToMany(() => OrdenCompraItem, (item) => item.orden_compra, { cascade: true })
  items: OrdenCompraItem[];

  @Column({ nullable: true })
  created_by: number;

  @Column({ nullable: true })
  updated_by: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updated_at: Date;
  }
