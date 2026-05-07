import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { PurchasesProvider } from './purchases-provider.entity';
import { BillingType } from './billing-type.entity';

/** Tabla intermedia: qué tipos de facturación acepta cada proveedor. */
@Entity('provider_billing_types')
@Unique(['provider_id', 'billing_type_id'])
export class ProviderBillingType {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  provider_id: number;

  @Column()
  billing_type_id: number;

  /** ID de tipo_pago para la parte A. */
  @Column({ type: 'int', nullable: true })
  modo_pago_a_id: number;

  /** ID de tipo_pago para la parte B. */
  @Column({ type: 'int', nullable: true })
  modo_pago_b_id: number;

  @ManyToOne(() => PurchasesProvider, (p) => p.billing_types, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'provider_id' })
  provider: PurchasesProvider;

  @ManyToOne(() => BillingType, (bt) => bt.provider_billing_types, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'billing_type_id' })
  billing_type: BillingType;
}
