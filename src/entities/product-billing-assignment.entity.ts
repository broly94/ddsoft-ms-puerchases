import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { PurchasesProvider } from './purchases-provider.entity';
import { BillingType } from './billing-type.entity';

/**
 * Asigna UN tipo de facturación a cada artículo dentro de un proveedor.
 * El billing_type_id debe pertenecer a los tipos que acepta el proveedor.
 * cod_articulo es varchar porque los códigos de Gescom pueden tener ceros a la izquierda ("000212").
 */
@Entity('product_billing_assignments')
@Unique(['cod_articulo', 'provider_id'])
export class ProductBillingAssignment {
  @PrimaryGeneratedColumn()
  id: number;

  /** Código del artículo en Gescom (varchar, puede ser "000212"). */
  @Column({ length: 50 })
  cod_articulo: string;

  @Column()
  provider_id: number;

  @Column()
  billing_type_id: number;

  @ManyToOne(() => PurchasesProvider, (p) => p.product_assignments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'provider_id' })
  provider: PurchasesProvider;

  @ManyToOne(() => BillingType, (bt) => bt.product_assignments, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'billing_type_id' })
  billing_type: BillingType;

  @Column({ nullable: true })
  created_by: number;

  @Column({ nullable: true })
  updated_by: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updated_at: Date;
}
