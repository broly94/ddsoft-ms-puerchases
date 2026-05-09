import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { BillingType } from '../entities/billing-type.entity';
import { PurchasesProvider } from '../entities/purchases-provider.entity';
import { ProviderBillingType } from '../entities/provider-billing-type.entity';
import { ProductBillingAssignment } from '../entities/product-billing-assignment.entity';

@Injectable()
export class ProvidersService {
  private readonly logger = new Logger(ProvidersService.name);

  constructor(
    @InjectRepository(BillingType)
    private readonly billingTypeRepo: Repository<BillingType>,

    @InjectRepository(PurchasesProvider)
    private readonly providerRepo: Repository<PurchasesProvider>,

    @InjectRepository(ProviderBillingType)
    private readonly providerBillingRepo: Repository<ProviderBillingType>,

    @InjectRepository(ProductBillingAssignment)
    private readonly assignmentRepo: Repository<ProductBillingAssignment>,
  ) {}

  // ── Billing Types ─────────────────────────────────────────────────────────

  async getAllBillingTypes(): Promise<BillingType[]> {
    return this.billingTypeRepo.find({ order: { pct_a: 'DESC' } });
  }

  async createBillingType(data: {
    nombre: string;
    pct_a: number;
    pct_b: number;
    created_by?: number;
  }): Promise<BillingType> {
    const sum = Number(data.pct_a) + Number(data.pct_b);
    if (Math.abs(sum - 100) > 0.01) {
      throw new BadRequestException(`pct_a + pct_b debe sumar 100 (actual: ${sum})`);
    }
    const entity = this.billingTypeRepo.create(data);
    return this.billingTypeRepo.save(entity);
  }

  async updateBillingType(id: number, data: Partial<{
    nombre: string;
    pct_a: number;
    pct_b: number;
    activo: boolean;
    updated_by: number;
  }>): Promise<BillingType> {
    const bt = await this.billingTypeRepo.findOne({ where: { id_billing_type: id } });
    if (!bt) throw new NotFoundException(`BillingType ${id} no encontrado`);

    if (data.pct_a !== undefined || data.pct_b !== undefined) {
      const a = data.pct_a ?? bt.pct_a;
      const b = data.pct_b ?? bt.pct_b;
      if (Math.abs(Number(a) + Number(b) - 100) > 0.01) {
        throw new BadRequestException(`pct_a + pct_b debe sumar 100`);
      }
    }
    Object.assign(bt, data);
    return this.billingTypeRepo.save(bt);
  }

  async deleteBillingType(id: number): Promise<void> {
    const used = await this.providerBillingRepo.count({ where: { billing_type_id: id } });
    if (used > 0) {
      throw new BadRequestException(`No se puede eliminar: está asignado a ${used} proveedor(es)`);
    }
    await this.billingTypeRepo.delete(id);
  }

  // ── Providers ─────────────────────────────────────────────────────────────

  async getAllProviders(): Promise<PurchasesProvider[]> {
    return this.providerRepo.find({
      relations: ['billing_types', 'billing_types.billing_type'],
      order: { created_at: 'DESC' },
    });
  }

  async getProviderByCod(codProveedor: string): Promise<PurchasesProvider | null> {
    return this.providerRepo.findOne({
      where: { cod_proveedor: codProveedor },
      relations: ['billing_types', 'billing_types.billing_type'],
    });
  }

  async getProviderById(id: number): Promise<PurchasesProvider> {
    const p = await this.providerRepo.findOne({
      where: { id_provider: id },
      relations: ['billing_types', 'billing_types.billing_type'],
    });
    if (!p) throw new NotFoundException(`Proveedor ${id} no encontrado`);
    return p;
  }

  async createProvider(data: {
    cod_proveedor: string;
    razon_social?: string;
    acepta_devoluciones?: boolean;
    trabaja_con_caja?: boolean;
    acepta_decomiso?: boolean;
    tipo_decomiso?: string;
    modos_pago?: string[];
    pronto_pago?: boolean;
    pronto_pago_pct?: number;
    pallets_minimos?: number;
    pallets_camion?: number;
    plazo_pago_a_dias?: number;
    plazo_pago_b_dias?: number;
    objetivo?: number;
    observaciones?: string;
    billing_type_ids?: number[];
    created_by?: number;
  }): Promise<PurchasesProvider> {
    const existing = await this.providerRepo.findOne({ where: { cod_proveedor: data.cod_proveedor } });
    if (existing) {
      throw new BadRequestException(`El proveedor con código ${data.cod_proveedor} ya está registrado`);
    }

    const { billing_type_ids, ...providerData } = data;
    const provider = await this.providerRepo.save(this.providerRepo.create(providerData));

    if (billing_type_ids?.length) {
      await this.setProviderBillingTypes(provider.id_provider, billing_type_ids.map((id) => ({ id })));
    }

    return this.getProviderById(provider.id_provider);
  }

  async updateProvider(id: number, data: Partial<{
    razon_social: string;
    acepta_devoluciones: boolean;
    trabaja_con_caja: boolean;
    acepta_decomiso: boolean;
    tipo_decomiso: string;
    modos_pago: string[];
    pronto_pago: boolean;
    pronto_pago_pct: number;
    pallets_minimos: number;
    pallets_camion: number;
    plazo_pago_a_dias: number;
    plazo_pago_b_dias: number;
    objetivo: number;
    observaciones: string;
    billing_types_config: { id: number; modo_pago_a_ids?: number[]; modo_pago_b_ids?: number[] }[];
    updated_by: number;
  }>): Promise<PurchasesProvider> {
    const provider = await this.getProviderById(id);
    const { billing_types_config, ...rest } = data;

    Object.assign(provider, rest);
    await this.providerRepo.save(provider);

    if (billing_types_config !== undefined) {
      await this.setProviderBillingTypes(id, billing_types_config);
    }

    return this.getProviderById(id);
  }

  /** Reemplaza los tipos de facturación del proveedor (sync completo), preservando modos de pago. */
  private async setProviderBillingTypes(
    providerId: number,
    billingTypes: { id: number; modo_pago_a_ids?: number[]; modo_pago_b_ids?: number[] }[],
  ): Promise<void> {
    await this.providerBillingRepo.delete({ provider_id: providerId });

    if (billingTypes.length === 0) return;

    const ids = billingTypes.map((bt) => bt.id);
    const existing = await this.billingTypeRepo.findBy({ id_billing_type: In(ids) });
    if (existing.length !== ids.length) {
      throw new BadRequestException('Uno o más billing_type_ids no existen');
    }

    const records = billingTypes.map((bt) =>
      this.providerBillingRepo.create({
        provider_id: providerId,
        billing_type_id: bt.id,
        modo_pago_a_ids: bt.modo_pago_a_ids ?? [],
        modo_pago_b_ids: bt.modo_pago_b_ids ?? [],
      }),
    );
    await this.providerBillingRepo.save(records);
  }

  // ── Product Billing Assignments ───────────────────────────────────────────

  /**
   * Devuelve todas las asignaciones de artículos para un proveedor.
   * Incluye el tipo de facturación resuelto.
   */
  async getAssignmentsByProvider(providerId: number): Promise<ProductBillingAssignment[]> {
    return this.assignmentRepo.find({
      where: { provider_id: providerId },
      relations: ['billing_type'],
      order: { cod_articulo: 'ASC' },
    });
  }

  /**
   * Devuelve las asignaciones de una lista de artículos para un proveedor.
   * Útil para saber qué tipo tiene asignado cada producto en la orden de compra.
   */
  async getAssignmentsByArticulos(
    providerId: number,
    codsArticulo: string[],
  ): Promise<ProductBillingAssignment[]> {
    if (!codsArticulo.length) return [];
    return this.assignmentRepo.find({
      where: { provider_id: providerId, cod_articulo: In(codsArticulo) },
      relations: ['billing_type'],
    });
  }

  /**
   * Asigna o actualiza el tipo de facturación de un artículo dentro de un proveedor.
   * El billing_type_id debe estar dentro de los tipos que acepta el proveedor.
   */
  async upsertAssignment(data: {
    provider_id: number;
    cod_articulo: string;
    billing_type_id: number;
    created_by?: number;
    updated_by?: number;
  }): Promise<ProductBillingAssignment> {
    // Validar que el billing_type pertenece al proveedor
    const allowed = await this.providerBillingRepo.findOne({
      where: { provider_id: data.provider_id, billing_type_id: data.billing_type_id },
    });
    if (!allowed) {
      throw new BadRequestException(
        `El tipo de facturación ${data.billing_type_id} no está asignado al proveedor ${data.provider_id}`,
      );
    }

    const existing = await this.assignmentRepo.findOne({
      where: { provider_id: data.provider_id, cod_articulo: data.cod_articulo },
    });

    if (existing) {
      existing.billing_type_id = data.billing_type_id;
      existing.updated_by = data.updated_by ?? existing.updated_by;
      return this.assignmentRepo.save(existing);
    }

    return this.assignmentRepo.save(this.assignmentRepo.create(data));
  }

  /**
   * Asignación masiva: recibe array de { cod_articulo, billing_type_id }
   * y hace upsert de todos. Todos deben usar tipos válidos del proveedor.
   */
  async bulkUpsertAssignments(
    providerId: number,
    items: { cod_articulo: string; billing_type_id: number }[],
    userId?: number,
  ): Promise<{ updated: number; created: number }> {
    if (!items.length) return { updated: 0, created: 0 };

    // Validar que todos los billing_type_ids pertenecen al proveedor
    const uniqueBtIds = [...new Set(items.map((i) => i.billing_type_id))];
    const allowed = await this.providerBillingRepo.find({
      where: { provider_id: providerId, billing_type_id: In(uniqueBtIds) },
    });
    const allowedIds = new Set(allowed.map((a) => a.billing_type_id));
    const invalid = uniqueBtIds.filter((id) => !allowedIds.has(id));
    if (invalid.length) {
      throw new BadRequestException(
        `Los siguientes billing_type_ids no pertenecen al proveedor: ${invalid.join(', ')}`,
      );
    }

    const cods = items.map((i) => i.cod_articulo);
    const existingMap = new Map(
      (await this.assignmentRepo.find({ where: { provider_id: providerId, cod_articulo: In(cods) } }))
        .map((a) => [a.cod_articulo, a]),
    );

    let created = 0;
    let updated = 0;
    const toSave: ProductBillingAssignment[] = [];

    for (const item of items) {
      const existing = existingMap.get(item.cod_articulo);
      if (existing) {
        existing.billing_type_id = item.billing_type_id;
        existing.updated_by = userId;
        toSave.push(existing);
        updated++;
      } else {
        toSave.push(
          this.assignmentRepo.create({
            provider_id: providerId,
            cod_articulo: item.cod_articulo,
            billing_type_id: item.billing_type_id,
            created_by: userId,
          }),
        );
        created++;
      }
    }

    await this.assignmentRepo.save(toSave);
    return { updated, created };
  }

  async deleteAssignment(providerId: number, codArticulo: string): Promise<void> {
    await this.assignmentRepo.delete({ provider_id: providerId, cod_articulo: codArticulo });
  }
}
