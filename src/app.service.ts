import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { OrdenCompraHeader } from './entities/orden-compra-header.entity';
import { PedidoHistorico } from './entities/pedido-historico.entity';
import { TipoPago } from './entities/tipo-pago.entity';
import { TurnoConfig } from './entities/turno-config.entity';
import { TurnoHeader } from './entities/turno-header.entity';
import { Turno } from './entities/turno.entity';

@Injectable()
export class AppService {
  constructor(
    @InjectRepository(OrdenCompraHeader)
    private ordenCompraRepository: Repository<OrdenCompraHeader>,
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
  ) {}

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

  async createOrder(data: Partial<OrdenCompraHeader>) {
    const order = this.ordenCompraRepository.create(data);
    return this.ordenCompraRepository.save(order);
  }

  async updateOrder(id: number, data: Partial<OrdenCompraHeader>) {
    const order = await this.ordenCompraRepository.findOneBy({ id_orden_compra: id });
    if (!order) throw new NotFoundException(`Order ${id} not found`);
    Object.assign(order, data);
    return this.ordenCompraRepository.save(order);
  }

  async deleteOrder(id: number) {
    const result = await this.ordenCompraRepository.delete(id);
    if (result.affected === 0) throw new NotFoundException(`Order ${id} not found`);
    return { success: true };
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
    for (const o of orders) {
      const exists = await this.turnoRepository.findOne({
        where: { turno_header_id: header.id, orden_compra_id: o.id_orden_compra },
      });
      const confirmed = pallets?.[o.id_orden_compra];
      if (!exists) {
        await this.turnoRepository.save(
          this.turnoRepository.create({
            turno_header_id: header.id,
            orden_compra_id: o.id_orden_compra,
            estado: 'pendiente',
            pallets_confirmados: confirmed != null ? confirmed : null,
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
