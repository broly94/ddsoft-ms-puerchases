import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { TipoPago } from './tipo-pago.entity';

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

  @Column({ nullable: true })
  turno_id: number | null;

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
