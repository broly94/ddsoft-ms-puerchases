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

  /** IDs de tipo_pago aceptados para la parte A (múltiples). */
  @Column({ type: 'simple-array', nullable: true })
  modo_pago_a_ids: number[];

  /** IDs de tipo_pago aceptados para la parte B (múltiples). */
  @Column({ type: 'simple-array', nullable: true })
  modo_pago_b_ids: number[];

  @ManyToOne(() => PurchasesProvider, (p) => p.billing_types, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'provider_id' })
  provider: PurchasesProvider;

  @ManyToOne(() => BillingType, (bt) => bt.provider_billing_types, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'billing_type_id' })
  billing_type: BillingType;
}
