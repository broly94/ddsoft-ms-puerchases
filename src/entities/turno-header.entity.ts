import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Turno } from './turno.entity';

@Entity('turnos_header')
export class TurnoHeader {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'date', unique: true })
  fecha: Date;

  @Column({ type: 'varchar', length: 20, default: 'pendiente' })
  estado: string; // pendiente | entregado | parcial | rechazado

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  total_pallets: number;

  @Column({ nullable: true })
  created_by: number;

  @Column({ nullable: true })
  updated_by: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updated_at: Date;

  @OneToMany(() => Turno, (t) => t.turno_header, { cascade: true })
  lines: Turno[];
}
