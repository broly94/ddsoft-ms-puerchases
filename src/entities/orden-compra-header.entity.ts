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

  @Column({ type: 'varchar', length: 100, nullable: true })
  tipo_facturacion: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  pallet: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  razon_social: string;

  @Column({ type: 'varchar', length: 50, nullable: false })
  cod_proveedor: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  marca: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  plazo_pago: string;

  @ManyToOne(() => TipoPago, (tipoPago) => tipoPago.ordenes_compra, { nullable: true })
  @JoinColumn({ name: 'id_tipo_pago' })
  tipo_pago: TipoPago;

  @Column({ type: 'decimal', precision: 18, scale: 2, nullable: true })
  monto: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  comprador: string;
}
