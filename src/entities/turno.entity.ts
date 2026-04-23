import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { TurnoHeader } from './turno-header.entity';
import { OrdenCompraHeader } from './orden-compra-header.entity';

@Entity('turnos')
@Unique(['turno_header_id', 'orden_compra_id'])
export class Turno {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  turno_header_id: number;

  @ManyToOne(() => TurnoHeader, (h) => h.lines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'turno_header_id' })
  turno_header: TurnoHeader;

  @Column()
  orden_compra_id: number;

  @ManyToOne(() => OrdenCompraHeader, { eager: false })
  @JoinColumn({ name: 'orden_compra_id' })
  orden_compra: OrdenCompraHeader;

  @Column({ type: 'varchar', length: 20, default: 'pendiente' })
  estado: string; // pendiente | entregado | no_entregado

  /** Pallets confirmados por el proveedor al turnar. NULL = usar cantidad_pallets del pedido. */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  pallets_confirmados: number | null;

  @Column({ nullable: true })
  created_by: number;

  @Column({ nullable: true })
  updated_by: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updated_at: Date;
}
