import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { OrdenCompraHeader } from './entities/orden-compra-header.entity';
import { TipoPago } from './entities/tipo-pago.entity';
import { TurnoConfig } from './entities/turno-config.entity';
import { TurnoHeader } from './entities/turno-header.entity';
import { Turno } from './entities/turno.entity';

@Injectable()
export class AppService {
  constructor(
    @InjectRepository(OrdenCompraHeader)
    private ordenCompraRepository: Repository<OrdenCompraHeader>,
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
   */
  async assignTurno(fecha: string, ids: number[], userId: number) {
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
      // Si ya está en este turno, ignorar
      const exists = await this.turnoRepository.findOne({
        where: { turno_header_id: header.id, orden_compra_id: o.id_orden_compra },
      });
      if (!exists) {
        await this.turnoRepository.save(
          this.turnoRepository.create({
            turno_header_id: header.id,
            orden_compra_id: o.id_orden_compra,
            estado: 'pendiente',
            created_by: userId,
            updated_by: userId,
          }),
        );
      }
      o.estado = 'turnado';
      o.fecha_turno = new Date(fecha);
      o.turno_id = header.id;
      o.updated_by = userId;
    }
    await this.ordenCompraRepository.save(orders);
    await this.syncHeader(header.id, userId);
    return this.getOneTurno(header.id);
  }

  /** Quita un pedido de un turno y lo devuelve a pendiente. */
  async removePedidoFromTurno(turnoId: number, ordenId: number, userId: number) {
    const line = await this.turnoRepository.findOne({
      where: { turno_header_id: turnoId, orden_compra_id: ordenId },
    });
    if (!line) throw new NotFoundException('Línea de turno no encontrada');
    await this.turnoRepository.remove(line);

    const order = await this.ordenCompraRepository.findOneBy({ id_orden_compra: ordenId });
    if (order) {
      order.estado = 'pendiente';
      order.fecha_turno = null;
      order.turno_id = null;
      order.updated_by = userId;
      await this.ordenCompraRepository.save(order);
    }

    const remaining = await this.turnoRepository.count({ where: { turno_header_id: turnoId } });
    if (remaining === 0) {
      await this.turnoHeaderRepository.delete(turnoId);
      return { deleted: true };
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

  /** Marca todos los pedidos pendientes de un turno como no entregados. */
  async rechazarTurno(turnoId: number, userId: number) {
    const lines = await this.turnoRepository.find({ where: { turno_header_id: turnoId } });
    for (const l of lines) {
      if (l.estado === 'pendiente') { l.estado = 'no_entregado'; l.updated_by = userId; }
    }
    await this.turnoRepository.save(lines);
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

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async getOneTurno(turnoId: number) {
    return this.turnoHeaderRepository.findOne({
      where: { id: turnoId },
      relations: ['lines', 'lines.orden_compra', 'lines.orden_compra.tipo_pago'],
    });
  }

  /** Recalcula estado y total_pallets del header a partir de sus líneas. */
  private async syncHeader(turnoId: number, userId?: number) {
    const header = await this.turnoHeaderRepository.findOne({
      where: { id: turnoId },
      relations: ['lines', 'lines.orden_compra'],
    });
    if (!header) return;

    const pendientes    = header.lines.filter((l) => l.estado === 'pendiente').length;
    const entregados    = header.lines.filter((l) => l.estado === 'entregado').length;
    const noEntregados  = header.lines.filter((l) => l.estado === 'no_entregado').length;

    if (pendientes > 0) {
      header.estado = 'pendiente';
    } else if (entregados > 0 && noEntregados === 0) {
      header.estado = 'entregado';
    } else if (noEntregados > 0 && entregados === 0) {
      header.estado = 'rechazado';
    } else {
      header.estado = 'parcial';
    }

    header.total_pallets = header.lines.reduce(
      (s, l) => s + (parseFloat(l.orden_compra?.cantidad_pallets as any) || 0),
      0,
    );
    if (userId) header.updated_by = userId;
    await this.turnoHeaderRepository.save(header);
  }

  // ── Tipo Pago ────────────────────────────────────────────────────────────

  async findAllTipoPagos() {
    return this.tipoPagoRepository.find();
  }

  async createTipoPago(data: Partial<TipoPago>) {
    return this.tipoPagoRepository.save(this.tipoPagoRepository.create(data));
  }
}
