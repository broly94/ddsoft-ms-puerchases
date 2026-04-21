import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Headers } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string { return this.appService.getHello(); }

  @MessagePattern('purchases.ping')
  ping(@Payload() data: any) { return { message: 'pong', data }; }

  // ── Ordenes de Compra ─────────────────────────────────────────────────────

  @Get('orders')
  findAllOrders() { return this.appService.findAllOrders(); }

  @Post('orders')
  createOrder(@Body() data: any) { return this.appService.createOrder(data); }

  @Put('orders/:id')
  updateOrder(@Param('id') id: string, @Body() data: any) {
    return this.appService.updateOrder(+id, data);
  }

  @Delete('orders/:id')
  deleteOrder(@Param('id') id: string) { return this.appService.deleteOrder(+id); }

  // ── Turno Config ──────────────────────────────────────────────────────────

  @Get('turnos/config')
  getTurnoConfig() { return this.appService.getTurnoConfig(); }

  @Put('turnos/config')
  updateTurnoConfig(@Body() body: { pallets_por_dia: number }) {
    return this.appService.updateTurnoConfig(body.pallets_por_dia);
  }

  // ── Turnos ────────────────────────────────────────────────────────────────

  @Get('turnos/calendar')
  getTurnoCalendar() { return this.appService.getTurnoCalendar(); }

  /** Asigna uno o varios pedidos a un turno (crea el header si no existe). */
  @Post('turnos/assign')
  assignTurno(
    @Body() body: { fecha: string; ids: number[] },
    @Headers('x-user-id') userId: string,
  ) {
    return this.appService.assignTurno(body.fecha, body.ids, +userId);
  }

  /** Cambia el estado de una línea individual dentro del turno. */
  @Patch('turnos/:turnoId/lines/:ordenId/estado')
  setLineEstado(
    @Param('turnoId') turnoId: string,
    @Param('ordenId') ordenId: string,
    @Body() body: { estado: string },
    @Headers('x-user-id') userId: string,
  ) {
    return this.appService.setLineEstado(+turnoId, +ordenId, body.estado, +userId);
  }

  /** Quita un pedido del turno y lo devuelve a pendiente. */
  @Delete('turnos/:turnoId/lines/:ordenId')
  removePedidoFromTurno(
    @Param('turnoId') turnoId: string,
    @Param('ordenId') ordenId: string,
    @Headers('x-user-id') userId: string,
  ) {
    return this.appService.removePedidoFromTurno(+turnoId, +ordenId, +userId);
  }

  /** Marca todos los pedidos pendientes del turno como entregados. */
  @Post('turnos/:turnoId/entregar')
  entregarTurno(
    @Param('turnoId') turnoId: string,
    @Headers('x-user-id') userId: string,
  ) {
    return this.appService.entregarTurno(+turnoId, +userId);
  }

  /** Marca todos los pedidos pendientes del turno como no entregados. */
  @Post('turnos/:turnoId/rechazar')
  rechazarTurno(
    @Param('turnoId') turnoId: string,
    @Headers('x-user-id') userId: string,
  ) {
    return this.appService.rechazarTurno(+turnoId, +userId);
  }

  /** Elimina el turno completo y devuelve todos los pedidos a pendiente. */
  @Delete('turnos/:turnoId')
  deleteTurno(
    @Param('turnoId') turnoId: string,
    @Headers('x-user-id') userId: string,
  ) {
    return this.appService.deleteTurno(+turnoId, +userId);
  }

  // ── Tipo Pago ─────────────────────────────────────────────────────────────

  @Get('tipo-pago')
  findAllTipoPagos() { return this.appService.findAllTipoPagos(); }

  @Post('tipo-pago')
  createTipoPago(@Body() data: any) { return this.appService.createTipoPago(data); }
}
