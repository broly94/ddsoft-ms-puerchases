import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { ProviderBillingType } from './provider-billing-type.entity';
import { ProductBillingAssignment } from './product-billing-assignment.entity';

@Entity('purchases_providers')
export class PurchasesProvider {
  @PrimaryGeneratedColumn()
  id_provider: number;

  /** Código del proveedor en Gescom (cross-DB ref, sin FK). Puede ser numérico con ceros: "00123". */
  @Column({ length: 50, unique: true })
  cod_proveedor: string;

  /** Razón social traída de Gescom al momento de registrar el proveedor. */
  @Column({ length: 255, nullable: true })
  razon_social: string;

  @Column({ type: 'boolean', default: false })
  acepta_devoluciones: boolean;

  /** ¿Trabaja con caja (pago en efectivo)? */
  @Column({ type: 'boolean', default: false })
  trabaja_con_caja: boolean;

  /** Compra mínima en pallets por orden de compra. */
  @Column({ type: 'int', nullable: true })
  pallets_minimos: number;

  /** Capacidad del camión del proveedor en pallets. */
  @Column({ type: 'int', nullable: true })
  pallets_camion: number;

  /** Modos de pago aceptados: efectivo, transferencia, cheque, deposito */
  @Column({ type: 'simple-array', nullable: true })
  modos_pago: string[];

  /** ¿Maneja pronto pago? */
  @Column({ type: 'boolean', default: false })
  pronto_pago: boolean;

  /** Porcentaje de descuento por pronto pago. Null si no aplica. */
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  pronto_pago_pct: number;

  /** ¿Acepta decomiso de mercadería? */
  @Column({ type: 'boolean', default: false })
  acepta_decomiso: boolean;

  /** Tipo de decomiso: 'con_autorizacion' | 'sin_autorizacion'. Null si no acepta decomiso. */
  @Column({ length: 20, nullable: true })
  tipo_decomiso: string;

  /** Plazo de pago en días (ej: 30, 60). */
  @Column({ type: 'int', nullable: true })
  plazo_pago_dias: number;

  @Column({ type: 'text', nullable: true })
  observaciones: string;

  @Column({ nullable: true })
  created_by: number;

  @Column({ nullable: true })
  updated_by: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updated_at: Date;

  @OneToMany(() => ProviderBillingType, (pbt) => pbt.provider, { cascade: true })
  billing_types: ProviderBillingType[];

  @OneToMany(() => ProductBillingAssignment, (pba) => pba.provider)
  product_assignments: ProductBillingAssignment[];
}
