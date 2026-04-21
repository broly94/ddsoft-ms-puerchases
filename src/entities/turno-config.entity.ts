import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('turno_config')
export class TurnoConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', default: 120 })
  pallets_por_dia: number;
}
