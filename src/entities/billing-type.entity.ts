import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { ProviderBillingType } from './provider-billing-type.entity';
import { ProductBillingAssignment } from './product-billing-assignment.entity';

@Entity('billing_types')
export class BillingType {
  @PrimaryGeneratedColumn()
  id_billing_type: number;

  /** Nombre descriptivo: "70/30", "50/50", "100/0", etc. */
  @Column({ length: 20 })
  nombre: string;

  /** Porcentaje Factura A (en blanco). Ej: 70.00 */
  @Column({ type: 'decimal', precision: 5, scale: 2 })
  pct_a: number;

  /** Porcentaje Factura B (en negro). Ej: 30.00 */
  @Column({ type: 'decimal', precision: 5, scale: 2 })
  pct_b: number;

  @Column({ default: true })
  activo: boolean;

  @Column({ nullable: true })
  created_by: number;

  @Column({ nullable: true })
  updated_by: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updated_at: Date;

  @OneToMany(() => ProviderBillingType, (pbt) => pbt.billing_type)
  provider_billing_types: ProviderBillingType[];

  @OneToMany(() => ProductBillingAssignment, (pba) => pba.billing_type)
  product_assignments: ProductBillingAssignment[];
}
