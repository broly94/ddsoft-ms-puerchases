import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

/**
 * Pedidos históricos migrados desde orden_compra_header.
 * Contiene órdenes cerradas/archivadas anteriores a la fecha de corte.
 */
@Entity('pedidos_historicos')
export class PedidoHistorico {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'date', nullable: true })
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

  @Column({ type: 'varchar', length: 255, nullable: true })
  tipo_pago_ids: string;

  @Column({ type: 'decimal', precision: 18, scale: 2, nullable: true })
  monto: number;

  @Column({ type: 'text', nullable: true })
  nota: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  comprador: string;

  @Column({ type: 'date', nullable: true })
  fecha_turno: Date;

  @Column({ type: 'varchar', length: 20, nullable: true })
  estado: string;

  @Column({ nullable: true })
  created_by: number;

  @Column({ nullable: true })
  updated_by: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updated_at: Date;
}
