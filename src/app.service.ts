import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import { OrdenCompraHeader } from './entities/orden-compra-header.entity';
import { OrdenCompraItem } from './entities/orden-compra-item.entity';
import { OrdenCompraCambio } from './entities/orden-compra-cambio.entity';
import { PedidoHistorico } from './entities/pedido-historico.entity';
import { TipoPago } from './entities/tipo-pago.entity';
import { TurnoConfig } from './entities/turno-config.entity';
import { TurnoHeader } from './entities/turno-header.entity';
import { Turno } from './entities/turno.entity';
import { PurchasesProvider } from './entities/purchases-provider.entity';
import { ProviderBillingType } from './entities/provider-billing-type.entity';
import { PurchasesConfig } from './entities/purchases-config.entity';
import { ProviderDeliveryStat } from './entities/provider-delivery-stat.entity';

@Injectable()
export class AppService {
  constructor(
    @InjectRepository(OrdenCompraHeader)
    private ordenCompraRepository: Repository<OrdenCompraHeader>,
    @InjectRepository(OrdenCompraItem)
    private ordenCompraItemRepository: Repository<OrdenCompraItem>,
    @InjectRepository(OrdenCompraCambio)
    private ordenCompraCambioRepository: Repository<OrdenCompraCambio>,
    @InjectRepository(PedidoHistorico)
    private pedidoHistoricoRepository: Repository<PedidoHistorico>,
    @InjectRepository(TipoPago)
    private tipoPagoRepository: Repository<TipoPago>,
    @InjectRepository(TurnoConfig)
    private turnoConfigRepository: Repository<TurnoConfig>,
    @InjectRepository(TurnoHeader)
    private turnoHeaderRepository: Repository<TurnoHeader>,
    @InjectRepository(Turno)
    private turnoRepository: Repository<Turno>,
    @InjectRepository(PurchasesProvider)
    private providerRepository: Repository<PurchasesProvider>,
    @InjectRepository(ProviderBillingType)
    private providerBillingRepository: Repository<ProviderBillingType>,
    @InjectRepository(PurchasesConfig)
    private purchasesConfigRepository: Repository<PurchasesConfig>,
    @InjectRepository(ProviderDeliveryStat)
    private deliveryStatRepository: Repository<ProviderDeliveryStat>,
  ) {}

  // ── Configuración de Compras (singleton id=1) ─────────────────────────────

  async getPurchasesConfig(): Promise<PurchasesConfig> {
    let cfg = await this.purchasesConfigRepository.findOneBy({ id: 1 });
    if (!cfg) {
      cfg = this.purchasesConfigRepository.create({ id: 1 });
      cfg = await this.purchasesConfigRepository.save(cfg);
    }
    return cfg;
  }

  async updatePurchasesConfig(data: Partial<PurchasesConfig>, userId?: number): Promise<PurchasesConfig> {
    const cfg = await this.getPurchasesConfig();
    const num = (v: any, d: number) => (v === null || v === undefined || v === '' || isNaN(Number(v)) ? d : Number(v));
    cfg.iva_general = num(data.iva_general, cfg.iva_general);
    cfg.percep_iva = num(data.percep_iva, cfg.percep_iva);
    cfg.percep_iibb_bsas = num(data.percep_iibb_bsas, cfg.percep_iibb_bsas);
    cfg.percep_iibb_caba = num(data.percep_iibb_caba, cfg.percep_iibb_caba);
    if (data.percep_iva_activo !== undefined) cfg.percep_iva_activo = !!data.percep_iva_activo;
    if (data.percep_iibb_bsas_activo !== undefined) cfg.percep_iibb_bsas_activo = !!data.percep_iibb_bsas_activo;
    if (data.percep_iibb_caba_activo !== undefined) cfg.percep_iibb_caba_activo = !!data.percep_iibb_caba_activo;
    const POLICIES = ['todos', 'creador_mod_admin', 'mod_admin', 'admin'];
    if (data.orden_edit_policy && POLICIES.includes(data.orden_edit_policy)) cfg.orden_edit_policy = data.orden_edit_policy;
    if (data.orden_delete_policy && POLICIES.includes(data.orden_delete_policy)) cfg.orden_delete_policy = data.orden_delete_policy;
    if (data.costo_source === 'erp' || data.costo_source === 'lista') cfg.costo_source = data.costo_source;
    if (['actual', 'pct', 'promedio'].includes(data.gap_fill_strategy as string)) cfg.gap_fill_strategy = data.gap_fill_strategy!;
    cfg.gap_fill_pct = num(data.gap_fill_pct, cfg.gap_fill_pct);
    cfg.pdp_cobertura_dias = Math.max(1, parseInt(String(data.pdp_cobertura_dias ?? cfg.pdp_cobertura_dias)) || cfg.pdp_cobertura_dias);
    cfg.pdp_porcentaje_vida_util = num(data.pdp_porcentaje_vida_util, cfg.pdp_porcentaje_vida_util);
    cfg.pdp_margen_sobre_stock = num(data.pdp_margen_sobre_stock, cfg.pdp_margen_sobre_stock);
    if (data.pdp_contemplar_promociones !== undefined) cfg.pdp_contemplar_promociones = !!data.pdp_contemplar_promociones;
    if (data.pdp_promedio_x2 !== undefined) cfg.pdp_promedio_x2 = !!data.pdp_promedio_x2;
    if (data.multiplo_activo !== undefined) cfg.multiplo_activo = !!data.multiplo_activo;
    cfg.multiplo_bultos = Math.max(1, parseInt(String(data.multiplo_bultos ?? cfg.multiplo_bultos)) || cfg.multiplo_bultos);
    if (Array.isArray(data.iva_producto_overrides)) cfg.iva_producto_overrides = data.iva_producto_overrides;
    cfg.updated_by = userId ?? cfg.updated_by ?? null;
    return this.purchasesConfigRepository.save(cfg);
  }

  getHello(): string {
    return 'Hello from Purchases Microservice!';
  }

  // ── Orden Compra Header ──────────────────────────────────────────────────

  async findAllOrders() {
    return this.ordenCompraRepository.find({
      relations: ['tipo_pago'],
      order: { fecha_pedido: 'DESC' },
    });
  }

  /** Orden completa (header + cambios) para precargar el wizard en modo edición. */
  async findOrderById(id: number) {
    const order = await this.ordenCompraRepository.findOne({
      where: { id_orden_compra: id },
      relations: ['tipo_pago', 'cambios'],
    });
    if (!order) throw new NotFoundException(`Orden ${id} no encontrada`);
    return order;
  }

  async createOrder(data: Partial<OrdenCompraHeader>, userId?: number) {
    const order = this.ordenCompraRepository.create(data);
    // Estampar quién la creó: la política "creador" depende de este campo, y hasta
    // ahora quedaba null (el create ignoraba el x-user-id). Ver docs/plan-orden-compra-permisos.md
    if (userId) { order.created_by = userId; order.updated_by = userId; }
    return this.ordenCompraRepository.save(order);
  }

  // ── Permisos de órdenes (editar/borrar) ───────────────────────────────────
  /** admin y supervisor = tier "administrador" (siempre pueden). */
  private esAdminTier = (role?: string) => role === 'admin' || role === 'supervisor';

  /**
   * ¿El usuario puede la acción sobre la orden, según la política de config?
   * policy: 'todos' | 'creador_mod_admin' | 'mod_admin' | 'admin'.
   */
  private cumplePolitica(policy: string, order: OrdenCompraHeader, userId?: number, role?: string): boolean {
    if (this.esAdminTier(role)) return true;
    const esCreador = order.created_by != null && order.created_by === userId;
    switch (policy) {
      case 'todos': return true;
      case 'creador_mod_admin': return esCreador || role === 'moderator';
      case 'mod_admin': return role === 'moderator';
      case 'admin': return false; // admin/supervisor ya devolvieron true arriba
      default: return true;
    }
  }

  /** Enforcement de EDICIÓN. Los borradores están exentos (crear/armar la orden es libre). */
  private async assertPuedeEditar(order: OrdenCompraHeader, userId?: number, role?: string) {
    if (order.estado === 'borrador') return; // creación en curso, no es "editar"
    const cfg = await this.getPurchasesConfig();
    if (!this.cumplePolitica(cfg.orden_edit_policy || 'creador_mod_admin', order, userId, role)) {
      throw new ForbiddenException('No tenés permiso para editar esta orden.');
    }
  }

  /** Enforcement de BORRADO. El creador puede descartar su propio borrador siempre. */
  private async assertPuedeBorrar(order: OrdenCompraHeader, userId?: number, role?: string) {
    if (order.estado === 'borrador' && order.created_by != null && order.created_by === userId) return;
    const cfg = await this.getPurchasesConfig();
    if (!this.cumplePolitica(cfg.orden_delete_policy || 'mod_admin', order, userId, role)) {
      throw new ForbiddenException('No tenés permiso para borrar esta orden.');
    }
  }

  /**
   * Marca de edición: se estampa SÓLO si la orden ya salió de 'borrador' (o sea, ya
   * fue confirmada). Editar un borrador es "seguir armándolo", no "editar una orden".
   * Crear/confirmar por el wizard NO cuenta como edición aunque toque el header.
   * Se chequea el estado GUARDADO (antes de aplicar los cambios de este request).
   */
  private stampEditIfConfirmed(order: OrdenCompraHeader, estadoGuardado: string) {
    if (estadoGuardado && estadoGuardado !== 'borrador') {
      order.fecha_ultima_edicion = new Date();
    }
  }

  async updateOrder(id: number, data: Partial<OrdenCompraHeader>, userId?: number, role?: string) {
    const order = await this.ordenCompraRepository.findOneBy({ id_orden_compra: id });
    if (!order) throw new NotFoundException(`Order ${id} not found`);
    await this.assertPuedeEditar(order, userId, role);
    const estadoGuardado = order.estado;
    if (userId) order.updated_by = userId;
    Object.assign(order, data);
    // El monto (= total facturado) depende de los % de facturación, que se editan en
    // el Paso 3 → hay que recalcularlo desde las líneas o quedaría stale.
    // Sin líneas no se toca: puede ser una orden con monto cargado a mano.
    const items = await this.ordenCompraItemRepository.find({ where: { orden_compra_id: id } });
    // Override manual del monto final (temporal): pisa el cálculo incluso sin líneas.
    if (order.monto_manual != null) {
      order.monto = Math.round(Number(order.monto_manual) * 100) / 100;
    } else if (items.length) {
      order.monto = this.montoFacturado(order, items);
    }
    this.stampEditIfConfirmed(order, estadoGuardado);
    return this.ordenCompraRepository.save(order);
  }

  async deleteOrder(id: number, userId?: number, role?: string) {
    const order = await this.ordenCompraRepository.findOneBy({ id_orden_compra: id });
    if (!order) throw new NotFoundException(`Order ${id} not found`);
    await this.assertPuedeBorrar(order, userId, role);
    // Si es un PADRE con restos apuntándole, los "libera": el remanente sigue siendo un
    // pedido válido, así que quedan como órdenes normales (referencia = null) en vez de
    // apuntar a una orden que ya no existe. Borrar un HIJO no requiere nada especial.
    await this.ordenCompraRepository.update({ referencia: id }, { referencia: null });
    await this.ordenCompraRepository.delete(id);
    return { success: true };
  }

  /**
   * Confirma una orden (borrador → pendiente) y estampa en el proveedor los % con
   * los que se facturó, para que arranquen la próxima orden de ese proveedor.
   *
   * OJO con el estado: confirmar deja la orden en **'pendiente'**, que es lo que
   * Turnos entiende por "lista para turnar" (su tab Sin Turnar filtra
   * `estado === 'pendiente' || 'rechazado'`). El ciclo real es:
   *   borrador → pendiente → turnado → (entregado/no_entregado viven en turnos.estado)
   * NO usar un estado 'confirmada': nadie lo lee y la orden queda invisible para
   * Turnos, o sea imposible de turnar. 'borrador' es el único estado que agregó el
   * wizard; el resto de la máquina es la de siempre.
   * Estado + estampado van en la misma transacción: no puede quedar una orden
   * confirmada sin memoria, ni memoria de una orden que no se confirmó.
   *
   * NO se estampa si la orden es genérica (no tiene facturación) o si el proveedor
   * no está registrado en DDSoft (existe en Gescom pero no acá → no hay dónde guardar).
   * Ver docs/plan-orden-compra-precios-facturacion.md §5
   */
  async confirmOrder(id: number, userId: number, role?: string) {
    const order = await this.ordenCompraRepository.findOneBy({ id_orden_compra: id });
    if (!order) throw new NotFoundException(`Orden ${id} no encontrada`);
    await this.assertPuedeEditar(order, userId, role); // no-op para borrador (confirmar = fin de creación)

    await this.ordenCompraRepository.manager.transaction(async (mgr) => {
      // 'pendiente' = confirmada y esperando turno. Es el estado que lee Turnos.
      order.estado = 'pendiente';
      order.updated_by = userId;
      // Red de seguridad: al confirmar, el monto del historial queda fijo. Si por lo
      // que sea llegó stale (confirm directo por API sin pasar por el wizard), se
      // recalcula acá para no dejar un número mentiroso en el historial.
      const items = await mgr.find(OrdenCompraItem, { where: { orden_compra_id: id } });
      if (items.length) order.monto = this.montoFacturado(order, items);
      await mgr.save(OrdenCompraHeader, order);

      if (order.es_generico || !order.cod_proveedor) return;
      // Sin facturación definida no hay nada que recordar. Estampar acá guardaría
      // un snapshot de ceros y la PRÓXIMA orden del proveedor arrancaría con 0% de
      // IVA en silencio: la memoria quedaría envenenada por una orden que nunca
      // definió sus %. Pasa con borradores anteriores a esta feature.
      if (order.iva_a_pct == null) return;

      // La orden guarda el código de Gescom, no el id_provider de DDSoft.
      const provider = await mgr.findOneBy(PurchasesProvider, { cod_proveedor: order.cod_proveedor });
      if (!provider) return;

      const pct = (v: any): number | null => (v === null || v === undefined ? null : Number(v));
      provider.ultima_facturacion = {
        iva_a_pct: pct(order.iva_a_pct) ?? 0,
        percep_iva: { activo: !!order.percep_iva_activo, pct: pct(order.percep_iva_pct) },
        percep_iibb_bsas: { activo: !!order.percep_iibb_bsas_activo, pct: pct(order.percep_iibb_bsas_pct) },
        percep_iibb_caba: { activo: !!order.percep_iibb_caba_activo, pct: pct(order.percep_iibb_caba_pct) },
        iva_b_activo: !!order.iva_b_activo,
        iva_b_pct: pct(order.iva_b_pct),
      };
      provider.ultima_facturacion_orden_id = order.id_orden_compra;
      provider.ultima_facturacion_fecha = new Date();
      provider.updated_by = userId;
      await mgr.save(PurchasesProvider, provider);
    });

    return this.findOrderById(id);
  }

  // ── Orden Compra Items (detalle de productos) ────────────────────────────

  async getOrderItems(ordenId: number) {
    return this.ordenCompraItemRepository.find({
      where: { orden_compra_id: ordenId },
      order: { id: 'ASC' },
    });
  }

  /**
   * `monto` del header = TOTAL FACTURADO: lo que va a facturar el proveedor.
   * Es el número que muestra el historial de órdenes.
   *
   *   neto    = Σ (cantidad_bultos × uxb_compra × precio_costo)   ← precio_costo es NETO
   *   Parte A = neto × cond_pct_a/100 × (1 + (iva_a_pct + Σ percep. activas)/100)
   *   Parte B = neto × cond_pct_b/100 × (1 + (iva_b_activo ? iva_b_pct : 0)/100)
   *
   * Los % van sobre el VALORIZADO FINAL de cada parte, no producto por producto.
   * El reparto A/B sale del snapshot pct_a/pct_b de las líneas (una orden = una condición).
   *
   * Casos borde:
   *  - Genérico: no tiene condición ni facturación → todo Parte A y, como sus % de
   *    facturación quedan en null, el total termina siendo el neto.
   *  - Orden sin condición (proveedor sin billing types): se asume 100% Parte A.
   *  - Orden vieja anterior a la migración de facturación (iva_a_pct null): los % dan 0
   *    y el monto degrada al neto, que es lo que mostraba antes.
   *
   * Ver docs/plan-orden-compra-precios-facturacion.md §3
   */
  private montoFacturado(
    header: OrdenCompraHeader,
    items: { cantidad_bultos: number; uxb_compra: number; precio_costo: number; pct_a: number | null; pct_b: number | null }[],
  ): number {
    // Override manual TEMPORAL: si el usuario cargó un monto a mano (sacado con Excel),
    // ese es el monto final, sin recálculo. Ver monto_manual en la entidad / MONTO_MANUAL_ENABLED.
    if (header.monto_manual != null) return Math.round(Number(header.monto_manual) * 100) / 100;
    const n = (v: any): number => Number(v) || 0;
    const neto = items.reduce((s, i) => s + n(i.cantidad_bultos) * n(i.uxb_compra) * n(i.precio_costo), 0);

    let condA = header.es_generico ? 100 : n(items.find((i) => i.pct_a != null)?.pct_a);
    let condB = header.es_generico ? 0 : n(items.find((i) => i.pct_b != null)?.pct_b);
    // Sin condición (o pct en cero) → todo se factura: si no, el monto daría 0.
    if (condA + condB === 0) { condA = 100; condB = 0; }

    const pctA =
      n(header.iva_a_pct) +
      (header.percep_iva_activo ? n(header.percep_iva_pct) : 0) +
      (header.percep_iibb_bsas_activo ? n(header.percep_iibb_bsas_pct) : 0) +
      (header.percep_iibb_caba_activo ? n(header.percep_iibb_caba_pct) : 0);
    const pctB = header.iva_b_activo ? n(header.iva_b_pct) : 0;

    const totalA = ((neto * condA) / 100) * (1 + pctA / 100);
    const totalB = ((neto * condB) / 100) * (1 + pctB / 100);
    let total = totalA + totalB;

    // Pronto pago: descuento sobre la facturación final. La base la decide la orden:
    // 'neto' (valorizado sin IVA) o 'total' (facturado c/IVA). El monto del historial
    // ya queda con el descuento aplicado. Ver docs/plan-orden-compra-datos-pago.md
    if (header.pronto_pago && header.pronto_pago_pct) {
      const pp = n(header.pronto_pago_pct);
      const base = header.pronto_pago_base === 'neto' ? neto : total;
      total -= (base * pp) / 100;
    }

    return Math.round(total * 100) / 100;
  }

  /**
   * Reemplaza el set completo de líneas de una orden (bulk replace) y recalcula
   * cantidad_pallets y monto (= total facturado) en el header.
   * Una orden = una condición de facturación: el billing_type_id del header se
   * ajusta al de las líneas.
   *
   * OJO con bonificación: `cantidad_bultos` son los PAGADOS y `bonif_bultos` lo gratis.
   *  - El valorizado (subtotal, monto) sale de los PAGADOS: lo gratis no se factura.
   *  - Los PALLETS salen de los RECIBIDOS (pagados + gratis): lo gratis ocupa lugar en
   *    el camión. cantidad_pallets alimenta la capacidad diaria de Turnos.
   * Ver docs/plan-orden-compra-bonificaciones.md
   */
  async saveOrderItems(ordenId: number, items: any[], userId: number, role?: string) {
    const header = await this.ordenCompraRepository.findOneBy({ id_orden_compra: ordenId });
    if (!header) throw new NotFoundException(`Orden ${ordenId} no encontrada`);
    await this.assertPuedeEditar(header, userId, role);

    const normalized = (items ?? []).map((it) => {
      const cantidad = Number(it.cantidad_bultos) || 0;
      const uxb = parseInt(it.uxb_compra) || 1;
      const bxp = parseInt(it.bxp) || 1;
      const precio = Number(it.precio_costo) || 0;
      const subtotal = cantidad * uxb * precio;
      const bonifBultos = Math.max(0, Number(it.bonif_bultos) || 0);
      // La bonificación del proveedor es un PAR: media regla no significa nada y
      // haría dividir por cero al recalcular. Sin par válido no hay snapshot.
      const bc = parseInt(it.bonif_compra);
      const bb = parseInt(it.bonif_bonifica);
      const parValido = !isNaN(bc) && !isNaN(bb) && bc > 0 && bb > 0;
      // El origen dice DE DÓNDE sale la bonificación, no si AHORA da bultos gratis:
      // una línea con regla 20+5 y 10 bultos pagados tiene 0 gratis pero la regla
      // sigue vigente (si suben a 20, recalcula). Anular el origen acá la desengancharía.
      // 'proveedor' exige regla válida; 'manual' es un valor fijo y exige bultos.
      const origenIn = it.bonif_origen === 'manual' || it.bonif_origen === 'proveedor' ? it.bonif_origen : null;
      const origen =
        origenIn === 'proveedor' ? (parValido ? 'proveedor' : null)
        : origenIn === 'manual' ? (bonifBultos > 0 ? 'manual' : null)
        : null;
      return {
        orden_compra_id: ordenId,
        cod_articulo: String(it.cod_articulo),
        descripcion: it.descripcion ?? null,
        marca: it.marca ?? null,
        linea: it.linea != null ? parseInt(it.linea) : null,
        cantidad_bultos: cantidad,
        uxb_compra: uxb,
        bxp,
        precio_costo: precio,
        billing_type_id: it.billing_type_id != null ? Number(it.billing_type_id) : null,
        pct_a: it.pct_a != null ? Number(it.pct_a) : null,
        pct_b: it.pct_b != null ? Number(it.pct_b) : null,
        subtotal,
        bonif_bultos: bonifBultos,
        bonif_compra: parValido ? bc : null,
        bonif_bonifica: parValido ? bb : null,
        bonif_origen: origen,
        ajustado_por_bonif: bonifBultos > 0 && !!it.ajustado_por_bonif,
        venta_diaria_bultos: it.venta_diaria_bultos != null ? Number(it.venta_diaria_bultos) : null,
        compra_sugerida_bultos: it.compra_sugerida_bultos != null ? parseInt(it.compra_sugerida_bultos) : null,
        dias_stock_restantes: it.dias_stock_restantes != null ? parseInt(it.dias_stock_restantes) : null,
        created_by: userId,
        updated_by: userId,
      };
    });

    await this.ordenCompraItemRepository.manager.transaction(async (mgr) => {
      await mgr.delete(OrdenCompraItem, { orden_compra_id: ordenId });
      if (normalized.length) {
        await mgr.save(OrdenCompraItem, normalized.map((n) => mgr.create(OrdenCompraItem, n)));
      }

      // Recalcular header desde el detalle.
      // Pallets sobre los RECIBIDOS (pagados + bonificados): lo gratis también ocupa
      // lugar en el camión y en el depósito. Sin bonificación, bonif_bultos = 0.
      // Paletizado FRACCIONADO: cada producto ocupa recibidos/bxp de pallet (NO redondea
      // para arriba), así los pallets mixtos (varios productos en 1 pallet) suman bien.
      // El total se guarda con la fracción tal cual (2 decimales); el turnero lo lee igual.
      const totalPallets = Math.round(
        normalized.reduce((s, n) => s + (n.cantidad_bultos + n.bonif_bultos) / (n.bxp || 1), 0) * 100,
      ) / 100;
      const condicion = normalized.find((n) => n.billing_type_id != null)?.billing_type_id ?? header.billing_type_id;

      if (normalized.length) {
        header.cantidad_pallets = String(totalPallets);
        header.monto = this.montoFacturado(header, normalized);
      }
      if (condicion != null) header.billing_type_id = condicion;
      header.updated_by = userId;
      // Cambiar los ítems de una orden ya confirmada cuenta como edición.
      this.stampEditIfConfirmed(header, header.estado);
      await mgr.save(OrdenCompraHeader, header);
    });

    return this.getOrderItems(ordenId);
  }

  // ── Cambios / Devoluciones de la orden (Paso 1 del wizard) ────────────────

  async getOrderCambios(ordenId: number) {
    return this.ordenCompraCambioRepository.find({
      where: { orden_compra_id: ordenId },
      order: { id: 'ASC' },
    });
  }

  /**
   * Reemplaza el set completo de cambios/devoluciones de una orden (bulk replace).
   * Ajusta el flag tiene_cambios del header según haya líneas o no.
   */
  async saveOrderCambios(ordenId: number, cambios: any[], userId: number, role?: string) {
    const header = await this.ordenCompraRepository.findOneBy({ id_orden_compra: ordenId });
    if (!header) throw new NotFoundException(`Orden ${ordenId} no encontrada`);
    await this.assertPuedeEditar(header, userId, role);

    const normalized = (cambios ?? []).map((c) => ({
      orden_compra_id: ordenId,
      cod_articulo: String(c.cod_articulo),
      descripcion: c.descripcion ?? null,
      cantidad_unidades: Number(c.cantidad_unidades) || 0,
      uxb: parseInt(c.uxb) || 1,
      tipo: c.tipo === 'devolucion' ? 'devolucion' : 'cambio',
      motivo: c.motivo ? String(c.motivo).slice(0, 255) : null,
      precio_costo: Number(c.precio_costo) || 0,
      billing_type_id: c.billing_type_id != null ? Number(c.billing_type_id) : null,
      pct_a: c.pct_a != null ? Number(c.pct_a) : null,
      pct_b: c.pct_b != null ? Number(c.pct_b) : null,
      tipo_facturacion: c.tipo_facturacion ? String(c.tipo_facturacion).slice(0, 255) : null,
      created_by: userId,
    }));

    await this.ordenCompraCambioRepository.manager.transaction(async (mgr) => {
      await mgr.delete(OrdenCompraCambio, { orden_compra_id: ordenId });
      if (normalized.length) {
        await mgr.save(OrdenCompraCambio, normalized.map((n) => mgr.create(OrdenCompraCambio, n)));
      }
      header.tiene_cambios = normalized.length > 0;
      header.updated_by = userId;
      this.stampEditIfConfirmed(header, header.estado);
      await mgr.save(OrdenCompraHeader, header);
    });

    return this.getOrderCambios(ordenId);
  }

  // ── Turno Config ─────────────────────────────────────────────────────────

  async getTurnoConfig() {
    let config = await this.turnoConfigRepository.findOneBy({ id: 1 });
    if (!config) {
      config = this.turnoConfigRepository.create({ id: 1, pallets_por_dia: 120 });
      await this.turnoConfigRepository.save(config);
    }
    return config;
  }

  async updateTurnoConfig(pallets_por_dia: number) {
    let config = await this.turnoConfigRepository.findOneBy({ id: 1 });
    if (!config) config = this.turnoConfigRepository.create({ id: 1, pallets_por_dia });
    else config.pallets_por_dia = pallets_por_dia;
    return this.turnoConfigRepository.save(config);
  }

  // ── Turnos ────────────────────────────────────────────────────────────────

  /** Devuelve todos los turnos con sus líneas y los pedidos asociados. */
  async getTurnoCalendar() {
    return this.turnoHeaderRepository.find({
      relations: ['lines', 'lines.orden_compra', 'lines.orden_compra.tipo_pago'],
      order: { fecha: 'ASC' },
    });
  }

  /**
   * Asigna pedidos a un turno.
   * Si ya existe un turno para esa fecha lo reutiliza, si no lo crea.
   *
   * incompletos: IDs de pedidos que se entregan parcialmente.
   *   Para cada uno se crea una orden "resto" con los pallets restantes (original - confirmados)
   *   que vuelve a Sin Turnar como pendiente.
   */
  async assignTurno(
    fecha: string,
    ids: number[],
    userId: number,
    pallets?: Record<number, number>,
    incompletos?: number[],
  ) {
    const fechaDate = new Date(fecha) as any;

    let header = await this.turnoHeaderRepository.findOne({ where: { fecha: fechaDate } });
    if (!header) {
      header = this.turnoHeaderRepository.create({
        fecha: fechaDate,
        estado: 'pendiente',
        total_pallets: 0,
        created_by: userId,
        updated_by: userId,
      });
      header = await this.turnoHeaderRepository.save(header);
    } else {
      header.updated_by = userId;
      await this.turnoHeaderRepository.save(header);
    }

    const orders = await this.ordenCompraRepository.findByIds(ids);

    // Determinar si cada proveedor tiene CE configurado en alguna parte de sus billing types
    const uniqueCods = [...new Set(orders.map(o => o.cod_proveedor).filter(Boolean))];
    const providerCeMap = new Map<string, boolean>();
    if (uniqueCods.length > 0) {
      const providers = await this.providerRepository.find({
        where: { cod_proveedor: In(uniqueCods) },
        relations: ['billing_types'],
      });
      for (const p of providers) {
        const hasCe = p.billing_types?.some(bt => bt.contra_entrega_a || bt.contra_entrega_b) ?? false;
        providerCeMap.set(p.cod_proveedor, hasCe);
      }
    }

    for (const o of orders) {
      const exists = await this.turnoRepository.findOne({
        where: { turno_header_id: header.id, orden_compra_id: o.id_orden_compra },
      });
      const confirmed = pallets?.[o.id_orden_compra];
      const contraEntregaDefault = providerCeMap.get(o.cod_proveedor) ?? false;
      if (!exists) {
        await this.turnoRepository.save(
          this.turnoRepository.create({
            turno_header_id: header.id,
            orden_compra_id: o.id_orden_compra,
            estado: 'pendiente',
            pallets_confirmados: confirmed != null ? confirmed : null,
            contra_entrega: contraEntregaDefault,
            created_by: userId,
            updated_by: userId,
          }),
        );
      } else if (exists.estado === 'quitado') {
        exists.estado = 'pendiente';
        exists.pallets_confirmados = confirmed != null ? confirmed : null;
        exists.updated_by = userId;
        await this.turnoRepository.save(exists);
      }
      o.estado = 'turnado';
      o.fecha_turno = new Date(fecha);
      o.turno_id = header.id;
      o.updated_by = userId;

      // ── Entrega parcial: crear orden "resto" ──────────────────────────────
      if (incompletos?.includes(o.id_orden_compra) && confirmed != null && confirmed > 0) {
        const originalPallets = parseFloat(o.cantidad_pallets as any) || 0;
        const restantes = Math.max(0, originalPallets - confirmed);
        if (restantes > 0) {
          const resto = this.ordenCompraRepository.create({
            fecha_pedido:     o.fecha_pedido,
            motivo_pedido:    o.motivo_pedido,
            tipo_facturacion: o.tipo_facturacion,
            cantidad_pallets: String(restantes),
            razon_social:     o.razon_social,
            cod_proveedor:    o.cod_proveedor,
            marca:            o.marca,
            plazo_pago:       o.plazo_pago,
            id_tipo_pago:     o.id_tipo_pago,
            tipo_pago_ids:    o.tipo_pago_ids,
            monto:            o.monto,
            nota:             o.nota,
            comprador:        o.comprador,
            estado:           'pendiente',
            turno_id:         null,
            fecha_turno:      null,
            // Referencia a la RAÍZ: si la original ya es un resto, se hereda su referencia;
            // si no, apunta a la original. Los restos quedan fuera del promedio de entrega.
            referencia:       o.referencia ?? o.id_orden_compra,
            created_by:       userId,
            updated_by:       userId,
          });
          await this.ordenCompraRepository.save(resto);
        }
      }
    }

    await this.ordenCompraRepository.save(orders);
    await this.syncHeader(header.id, userId);
    return this.getOneTurno(header.id);
  }

  /** Quita un pedido de un turno y lo devuelve a pendiente o rechazado según su estado. */
  async removePedidoFromTurno(turnoId: number, ordenId: number, userId: number) {
    const line = await this.turnoRepository.findOne({
      where: { turno_header_id: turnoId, orden_compra_id: ordenId },
    });
    if (!line) throw new NotFoundException('Línea de turno no encontrada');
    const wasRejected = line.estado === 'no_entregado';

    // Soft-delete: queda en el turno como registro histórico
    line.estado = 'quitado';
    line.updated_by = userId;
    await this.turnoRepository.save(line);

    const order = await this.ordenCompraRepository.findOneBy({ id_orden_compra: ordenId });
    if (order) {
      order.estado = wasRejected ? 'rechazado' : 'pendiente';
      order.fecha_turno = null;
      order.turno_id = null;
      order.updated_by = userId;
      await this.ordenCompraRepository.save(order);
    }

    await this.syncHeader(turnoId, userId);
    return this.getOneTurno(turnoId);
  }

  /**
   * Marca la línea como no entregada Y la quita del turno,
   * devolviendo el pedido a Sin Turnar con estado 'rechazado'.
   */
  async rejectAndReturn(turnoId: number, ordenId: number, userId: number) {
    const line = await this.turnoRepository.findOne({
      where: { turno_header_id: turnoId, orden_compra_id: ordenId },
    });
    if (!line) throw new NotFoundException('Línea de turno no encontrada');

    // Soft-delete: queda en el turno como registro histórico
    line.estado = 'quitado';
    line.updated_by = userId;
    await this.turnoRepository.save(line);

    const order = await this.ordenCompraRepository.findOneBy({ id_orden_compra: ordenId });
    if (order) {
      order.estado = 'rechazado';
      order.fecha_turno = null;
      order.turno_id = null;
      order.updated_by = userId;
      await this.ordenCompraRepository.save(order);
    }

    await this.syncHeader(turnoId, userId);
    return this.getOneTurno(turnoId);
  }

  /** Cambia el estado de una línea individual (entregado / no_entregado / pendiente). */
  async setLineEstado(turnoId: number, ordenId: number, estado: string, userId: number) {
    const line = await this.turnoRepository.findOne({
      where: { turno_header_id: turnoId, orden_compra_id: ordenId },
    });
    if (!line) throw new NotFoundException('Línea de turno no encontrada');
    line.estado = estado;
    line.updated_by = userId;
    await this.turnoRepository.save(line);
    await this.syncHeader(turnoId, userId);
    return this.getOneTurno(turnoId);
  }

  /** Marca todos los pedidos pendientes de un turno como entregados. */
  async entregarTurno(turnoId: number, userId: number) {
    const lines = await this.turnoRepository.find({ where: { turno_header_id: turnoId } });
    for (const l of lines) {
      if (l.estado === 'pendiente') { l.estado = 'entregado'; l.updated_by = userId; }
    }
    await this.turnoRepository.save(lines);
    await this.syncHeader(turnoId, userId);
    return this.getOneTurno(turnoId);
  }

  /**
   * Rechaza los pedidos pendientes del turno:
   * los marca como 'quitado' (soft-delete) y los devuelve a Sin Turnar con estado 'rechazado'.
   */
  async rechazarTurno(turnoId: number, userId: number) {
    const lines = await this.turnoRepository.find({ where: { turno_header_id: turnoId } });
    const pendingLines = lines.filter(l => l.estado === 'pendiente');

    if (pendingLines.length) {
      const orderIds = pendingLines.map(l => l.orden_compra_id);

      // Soft-delete: quedan en el turno como registro histórico
      for (const l of pendingLines) {
        l.estado = 'quitado';
        l.updated_by = userId;
      }
      await this.turnoRepository.save(pendingLines);

      const orders = await this.ordenCompraRepository.findByIds(orderIds);
      for (const o of orders) {
        o.estado = 'rechazado';
        o.fecha_turno = null;
        o.turno_id = null;
        o.updated_by = userId;
      }
      await this.ordenCompraRepository.save(orders);
    }

    await this.syncHeader(turnoId, userId);
    return this.getOneTurno(turnoId);
  }

  /** Elimina el turno completo y devuelve todos los pedidos a pendiente. */
  async deleteTurno(turnoId: number, userId: number) {
    const lines = await this.turnoRepository.find({ where: { turno_header_id: turnoId } });
    const orderIds = lines.map((l) => l.orden_compra_id);
    if (orderIds.length) {
      const orders = await this.ordenCompraRepository.findByIds(orderIds);
      for (const o of orders) {
        o.estado = 'pendiente';
        o.fecha_turno = null;
        o.turno_id = null;
        o.updated_by = userId;
      }
      await this.ordenCompraRepository.save(orders);
    }
    await this.turnoHeaderRepository.delete(turnoId);
    return { success: true };
  }

  /** Restaura una línea quitada a 'pendiente' o 'entregado' y vuelve a asignar el pedido al turno. */
  async restoreQuitadoLine(turnoId: number, ordenId: number, estado: string, userId: number) {
    const line = await this.turnoRepository.findOne({
      where: { turno_header_id: turnoId, orden_compra_id: ordenId },
    });
    if (!line) throw new NotFoundException('Línea no encontrada');

    line.estado = estado;
    line.updated_by = userId;
    await this.turnoRepository.save(line);

    const header = await this.turnoHeaderRepository.findOneBy({ id: turnoId });
    const order  = await this.ordenCompraRepository.findOneBy({ id_orden_compra: ordenId });
    if (order && header) {
      order.estado     = 'turnado';
      order.turno_id   = turnoId;
      order.fecha_turno = header.fecha;
      order.updated_by  = userId;
      await this.ordenCompraRepository.save(order);
    }

    await this.syncHeader(turnoId, userId);
    return this.getOneTurno(turnoId);
  }

  /** Elimina definitivamente una línea quitada (hard delete). El pedido queda en su estado actual en Sin Turnar. */
  async deleteQuitadoLine(turnoId: number, ordenId: number, userId: number) {
    const line = await this.turnoRepository.findOne({
      where: { turno_header_id: turnoId, orden_compra_id: ordenId },
    });
    if (!line) throw new NotFoundException('Línea no encontrada');

    await this.turnoRepository.remove(line);

    const remaining = await this.turnoRepository.count({ where: { turno_header_id: turnoId } });
    if (remaining === 0) {
      await this.turnoHeaderRepository.delete(turnoId);
      return { deleted: true };
    }

    await this.syncHeader(turnoId, userId);
    return this.getOneTurno(turnoId);
  }

  /** Activa/desactiva el flag temporal "contra entrega" de una línea de turno. */
  async setContraEntrega(turnoId: number, ordenId: number, value: boolean, userId: number) {
    const line = await this.turnoRepository.findOne({
      where: { turno_header_id: turnoId, orden_compra_id: ordenId },
    });
    if (!line) throw new NotFoundException('Línea de turno no encontrada');
    line.contra_entrega = value;
    line.updated_by = userId;
    await this.turnoRepository.save(line);
    return this.getOneTurno(turnoId);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async getOneTurno(turnoId: number) {
    return this.turnoHeaderRepository.findOne({
      where: { id: turnoId },
      relations: ['lines', 'lines.orden_compra', 'lines.orden_compra.tipo_pago'],
    });
  }

  /**
   * Recalcula estado y total_pallets del header.
   *
   * Reglas de estado:
   *  - Sin líneas activas, sin quitados    → 'pendiente' (turno vacío, día libre)
   *  - Sin líneas activas, CON quitados    → conserva estado actual (rechazado/parcial, día bloqueado)
   *  - Hay pendientes activos              → 'pendiente' (turno en curso, aceptar más pedidos)
   *  - Sin pendientes, solo entregados     → 'entregado' | 'parcial' si hay quitados (algo no vino)
   *  - Sin pendientes, solo no_entregados  → 'rechazado'
   *  - Sin pendientes, mix ent+no_ent      → 'parcial'
   */
  private async syncHeader(turnoId: number, userId?: number) {
    const header = await this.turnoHeaderRepository.findOneBy({ id: turnoId });
    if (!header) return;

    const allLines = await this.turnoRepository.find({
      where: { turno_header_id: turnoId },
      relations: ['orden_compra'],
    });

    const hasQuitados  = allLines.some((l) => l.estado === 'quitado');
    const activeLines  = allLines.filter((l) => l.estado !== 'quitado');
    const pendientes   = activeLines.filter((l) => l.estado === 'pendiente').length;
    const entregados   = activeLines.filter((l) => l.estado === 'entregado').length;
    const noEntregados = activeLines.filter((l) => l.estado === 'no_entregado').length;

    if (activeLines.length === 0) {
      if (!hasQuitados) {
        // Turno completamente vacío → libre
        header.estado        = 'pendiente';
        header.total_pallets = 0;
      }
      // Si hay quitados: día tuvo actividad (rechazado total) → no resetear el estado
    } else if (pendientes > 0) {
      // Turno aún en curso: siempre pendiente, sin importar quitados previos
      header.estado = 'pendiente';
    } else if (entregados > 0 && noEntregados === 0) {
      // Turno cerrado: solo entregados — parcial si hay quitados (algo no vino)
      header.estado = hasQuitados ? 'parcial' : 'entregado';
    } else if (noEntregados > 0 && entregados === 0) {
      header.estado = 'rechazado';
    } else {
      // Turno cerrado: mix entregados + no_entregados
      header.estado = 'parcial';
    }

    header.total_pallets = activeLines.reduce((s, l) => {
      const confirmed = l.pallets_confirmados != null ? Number(l.pallets_confirmados) : null;
      const original  = parseFloat(l.orden_compra?.cantidad_pallets as any) || 0;
      return s + (confirmed ?? original);
    }, 0);

    if (userId) header.updated_by = userId;
    await this.turnoHeaderRepository.save(header);
  }

  /**
   * "Solo marcar rechazado": líneas pendientes → no_entregado (visibles en turno),
   * pedidos REGRESAN a Sin Turnar como 'rechazado' (pueden volver a turnarse).
   * Día queda bloqueado como rechazado.
   */
  async marcarRechazadoTurno(turnoId: number, userId: number) {
    const lines = await this.turnoRepository.find({ where: { turno_header_id: turnoId } });
    const pendingLines = lines.filter((l) => l.estado === 'pendiente');
    const orderIds = pendingLines.map((l) => l.orden_compra_id);

    for (const l of pendingLines) {
      l.estado     = 'no_entregado';
      l.updated_by = userId;
    }
    if (pendingLines.length) await this.turnoRepository.save(pendingLines);

    // Devolver pedidos a Sin Turnar (pueden re-turnarse)
    if (orderIds.length) {
      const orders = await this.ordenCompraRepository.findByIds(orderIds);
      for (const o of orders) {
        o.estado     = 'rechazado';
        o.turno_id   = null;
        o.fecha_turno = null;
        o.updated_by  = userId;
      }
      await this.ordenCompraRepository.save(orders);
    }

    await this.syncHeader(turnoId, userId);
    return this.getOneTurno(turnoId);
  }

  /**
   * "Rechazar permanente": líneas pendientes → no_entregado (visibles en turno),
   * pedidos QUEDAN registrados en el turno (no regresan a Sin Turnar, no pueden re-turnarse).
   * Día queda bloqueado como rechazado definitivamente.
   */
  async rechazarPermanenteTurno(turnoId: number, userId: number) {
    const lines = await this.turnoRepository.find({ where: { turno_header_id: turnoId } });
    const pendingLines = lines.filter((l) => l.estado === 'pendiente');

    for (const l of pendingLines) {
      l.estado     = 'no_entregado';
      l.updated_by = userId;
    }
    if (pendingLines.length) await this.turnoRepository.save(pendingLines);

    // Los pedidos quedan con estado 'turnado' apuntando al turno (no aparecen en Sin Turnar)
    await this.syncHeader(turnoId, userId);
    return this.getOneTurno(turnoId);
  }

  /**
   * Revierte el rechazo de un día (error humano):
   * líneas no_entregado → pendiente, pedidos re-asignados al turno como 'turnado'.
   * Funciona para ambos tipos de rechazo (marcar y permanente).
   */
  async revertirRechazoDia(turnoId: number, userId: number) {
    const header = await this.turnoHeaderRepository.findOneBy({ id: turnoId });
    if (!header) throw new NotFoundException('Turno no encontrado');

    const lines = await this.turnoRepository.find({ where: { turno_header_id: turnoId } });
    const rechazadasLines = lines.filter((l) => l.estado === 'no_entregado');
    const orderIds = rechazadasLines.map((l) => l.orden_compra_id);

    for (const l of rechazadasLines) {
      l.estado     = 'pendiente';
      l.updated_by = userId;
    }
    if (rechazadasLines.length) await this.turnoRepository.save(rechazadasLines);

    // Re-asignar pedidos al turno (cubre ambos casos: los que volvieron a Sin Turnar y los que quedaron)
    if (orderIds.length) {
      const orders = await this.ordenCompraRepository.findByIds(orderIds);
      for (const o of orders) {
        o.estado     = 'turnado';
        o.turno_id   = turnoId;
        o.fecha_turno = header.fecha as any;
        o.updated_by  = userId;
      }
      await this.ordenCompraRepository.save(orders);
    }

    await this.syncHeader(turnoId, userId);
    return this.getOneTurno(turnoId);
  }

  // ── Analysis ─────────────────────────────────────────────────────────────

  /**
   * Devuelve todos los proveedores con sus fechas de pedido agrupadas.
   * Usado para calcular el promedio de días de entrega cruzando con el WMS.
   */
  async getProviderOrderDates(): Promise<{ cod_proveedor: string; razon_social: string; ordenes: { id: string; fecha: string }[] }[]> {
    const [activos, historicos] = await Promise.all([
      // Solo órdenes con al menos un turno entregado (completas o parcialmente entregadas)
      this.ordenCompraRepository
        .createQueryBuilder('oc')
        .select(['oc.id_orden_compra', 'oc.cod_proveedor', 'oc.razon_social', 'oc.fecha_pedido'])
        .innerJoin('turnos', 't', 't.orden_compra_id = oc.id_orden_compra AND t.estado = :estado', { estado: 'entregado' })
        .where('oc.cod_proveedor IS NOT NULL')
        // Los pedidos genéricos (faltantes de carga manual) no representan un pedido
        // real al proveedor, así que no deben distorsionar el promedio de entrega.
        .andWhere('oc.es_generico = false')
        // Los restos de entrega parcial (referencia != null) son el MISMO pedido lógico
        // que su original, y con fecha_pedido vieja + entrega tardía inflan el promedio.
        // Se excluyen: el pedido cuenta una sola vez (por su orden original).
        .andWhere('oc.referencia IS NULL')
        .distinct(true)
        .getMany(),
      this.pedidoHistoricoRepository.find({
        select: ['id', 'cod_proveedor', 'razon_social', 'fecha_pedido'],
        where: { cod_proveedor: Not(IsNull()) },
      }),
    ]);

    const map = new Map<string, { razon_social: string; ordenes: Map<string, string> }>();

    const addRow = (cod: string, razon: string, id: number, fecha: Date | null) => {
      if (!cod) return;
      if (!map.has(cod)) {
        map.set(cod, { razon_social: razon || '', ordenes: new Map() });
      }
      if (fecha) {
        const dateStr = new Date(fecha).toISOString().split('T')[0];
        map.get(cod)!.ordenes.set(String(id), dateStr);
      }
    };

    for (const o of activos)   addRow(o.cod_proveedor, o.razon_social, o.id_orden_compra, o.fecha_pedido);
    for (const o of historicos) addRow(o.cod_proveedor, o.razon_social, o.id, o.fecha_pedido);

    return Array.from(map.entries()).map(([cod, val]) => ({
      cod_proveedor: cod,
      razon_social: val.razon_social,
      ordenes: Array.from(val.ordenes.entries()).map(([id, fecha]) => ({ id, fecha })),
    }));
  }

  // ── Promedio de entrega por proveedor (provider_delivery_stats) ────────────

  /**
   * Guarda (upsert) el promedio CALCULADO por proveedor. Sólo toca promedio, cruzadas y
   * fecha; NO pisa el override manual ni el modo (los setea el usuario). Lo llama el
   * recálculo del gateway (endpoint manual + cronjob). Ver docs/plan-promedio-entrega-proveedor.md
   */
  async bulkSaveDeliveryStats(
    items: { cod_proveedor: string; promedio: number; cruzadas: number }[],
  ): Promise<{ updated: number }> {
    if (!items?.length) return { updated: 0 };
    const now = new Date();
    let updated = 0;
    for (const it of items) {
      if (!it.cod_proveedor) continue;
      let row = await this.deliveryStatRepository.findOneBy({ cod_proveedor: it.cod_proveedor });
      if (!row) row = this.deliveryStatRepository.create({ cod_proveedor: it.cod_proveedor, modo: 'auto' });
      row.dias_entrega_promedio = it.promedio ?? null;
      row.entregas_cruzadas = it.cruzadas ?? 0;
      row.actualizado = now;
      await this.deliveryStatRepository.save(row);
      updated++;
    }
    return { updated };
  }

  /** Todas las stats (para PdP / ficha del proveedor). */
  async getDeliveryStats(): Promise<ProviderDeliveryStat[]> {
    return this.deliveryStatRepository.find();
  }

  /** Stat de un proveedor puntual. */
  async getDeliveryStat(cod_proveedor: string): Promise<ProviderDeliveryStat | null> {
    return this.deliveryStatRepository.findOneBy({ cod_proveedor });
  }

  /**
   * Setea el modo (auto/manual) y el override manual de un proveedor. NO toca el promedio
   * calculado. Cobertura efectiva = modo==='manual' ? dias_entrega_manual : dias_entrega_promedio.
   */
  async setDeliveryMode(cod_proveedor: string, modo: string, manual: number | null): Promise<ProviderDeliveryStat> {
    let row = await this.deliveryStatRepository.findOneBy({ cod_proveedor });
    if (!row) row = this.deliveryStatRepository.create({ cod_proveedor });
    row.modo = modo === 'manual' ? 'manual' : 'auto';
    row.dias_entrega_manual = manual != null && !isNaN(Number(manual)) ? Math.round(Number(manual)) : null;
    return this.deliveryStatRepository.save(row);
  }

  // ── Tipo Pago ────────────────────────────────────────────────────────────

  async findAllTipoPagos() {
    return this.tipoPagoRepository.find();
  }

  async createTipoPago(data: Partial<TipoPago>) {
    return this.tipoPagoRepository.save(this.tipoPagoRepository.create(data));
  }

  async deleteTipoPago(id: number) {
    const tp = await this.tipoPagoRepository.findOneBy({ id_tipo_pago: id });
    if (!tp) throw new NotFoundException(`TipoPago ${id} not found`);
    await this.tipoPagoRepository.remove(tp);
    return { deleted: true };
  }
}
