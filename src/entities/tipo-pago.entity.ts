import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { OrdenCompraHeader } from './orden-compra-header.entity';

@Entity('tipo_pago')
export class TipoPago {
  @PrimaryGeneratedColumn()
  id_tipo_pago: number;

  @Column({ length: 100 })
  descripcion: string;

  @OneToMany(() => OrdenCompraHeader, (header) => header.tipo_pago)
  ordenes_compra: OrdenCompraHeader[];

  @Column({ default: 1 })
  created_by: number;

  @Column({ default: 1 })
  updated_by: number;
}
