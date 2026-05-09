import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ProvidersService } from './providers.service';

@Controller()
export class ProvidersController {
  constructor(private readonly service: ProvidersService) {}

  // ── Billing Types ─────────────────────────────────────────────────────────

  @MessagePattern({ cmd: 'billing_types.get_all' })
  getAllBillingTypes() {
    return this.service.getAllBillingTypes();
  }

  @MessagePattern({ cmd: 'billing_types.create' })
  createBillingType(@Payload() data: { nombre: string; pct_a: number; pct_b: number; created_by?: number }) {
    return this.service.createBillingType(data);
  }

  @MessagePattern({ cmd: 'billing_types.update' })
  updateBillingType(@Payload() data: { id: number; nombre?: string; pct_a?: number; pct_b?: number; activo?: boolean; updated_by?: number }) {
    const { id, ...rest } = data;
    return this.service.updateBillingType(id, rest);
  }

  @MessagePattern({ cmd: 'billing_types.delete' })
  deleteBillingType(@Payload() data: { id: number }) {
    return this.service.deleteBillingType(data.id);
  }

  // ── Providers ─────────────────────────────────────────────────────────────

  @MessagePattern({ cmd: 'providers.get_all' })
  getAllProviders() {
    return this.service.getAllProviders();
  }

  @MessagePattern({ cmd: 'providers.get_by_id' })
  getProviderById(@Payload() data: { id: number }) {
    return this.service.getProviderById(data.id);
  }

  @MessagePattern({ cmd: 'providers.get_by_cod' })
  getProviderByCod(@Payload() data: { cod_proveedor: string }) {
    return this.service.getProviderByCod(data.cod_proveedor);
  }

  @MessagePattern({ cmd: 'providers.create' })
  createProvider(@Payload() data: {
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
  }) {
    return this.service.createProvider(data);
  }

  @MessagePattern({ cmd: 'providers.update' })
  updateProvider(@Payload() data: {
    id: number;
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
    billing_types_config?: { id: number; modo_pago_a_ids?: number[]; modo_pago_b_ids?: number[] }[];
    updated_by?: number;
  }) {
    const { id, ...rest } = data;
    return this.service.updateProvider(id, rest);
  }

  // ── Product Billing Assignments ───────────────────────────────────────────

  @MessagePattern({ cmd: 'providers.assignments.get_by_provider' })
  getAssignmentsByProvider(@Payload() data: { provider_id: number }) {
    return this.service.getAssignmentsByProvider(data.provider_id);
  }

  @MessagePattern({ cmd: 'providers.assignments.get_by_articulos' })
  getAssignmentsByArticulos(@Payload() data: { provider_id: number; cods_articulo: string[] }) {
    return this.service.getAssignmentsByArticulos(data.provider_id, data.cods_articulo);
  }

  @MessagePattern({ cmd: 'providers.assignments.upsert' })
  upsertAssignment(@Payload() data: {
    provider_id: number;
    cod_articulo: string;
    billing_type_id: number;
    created_by?: number;
    updated_by?: number;
  }) {
    return this.service.upsertAssignment(data);
  }

  @MessagePattern({ cmd: 'providers.assignments.bulk_upsert' })
  bulkUpsertAssignments(@Payload() data: {
    provider_id: number;
    items: { cod_articulo: string; billing_type_id: number }[];
    user_id?: number;
  }) {
    return this.service.bulkUpsertAssignments(data.provider_id, data.items, data.user_id);
  }

  @MessagePattern({ cmd: 'providers.assignments.delete' })
  deleteAssignment(@Payload() data: { provider_id: number; cod_articulo: string }) {
    return this.service.deleteAssignment(data.provider_id, data.cod_articulo);
  }
}
