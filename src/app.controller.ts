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
    @Body() body: { fecha: string; ids: number[]; pallets?: Record<number, number> },
    @Headers('x-user-id') userId: string,
  ) {
    return this.appService.assignTurno(body.fecha, body.ids, +userId, body.pallets);
  }

  /** Marca la línea como no entregada y la devuelve a Sin Turnar con estado 'rechazado'. */
  @Post('turnos/:turnoId/lines/:ordenId/reject-return')
  rejectAndReturn(
    @Param('turnoId') turnoId: string,
    @Param('ordenId') ordenId: string,
    @Headers('x-user-id') userId: string,
  ) {
    return this.appService.rejectAndReturn(+turnoId, +ordenId, +userId);
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

  /** Restaura una línea quitada a pendiente o entregado. */
  @Patch('turnos/:turnoId/lines/:ordenId/restore')
  restoreQuitadoLine(
    @Param('turnoId') turnoId: string,
    @Param('ordenId') ordenId: string,
    @Body() body: { estado: string },
    @Headers('x-user-id') userId: string,
  ) {
    return this.appService.restoreQuitadoLine(+turnoId, +ordenId, body.estado, +userId);
  }

  /** Elimina definitivamente una línea quitada (hard delete). */
  @Delete('turnos/:turnoId/lines/:ordenId/permanent')
  deleteQuitadoLine(
    @Param('turnoId') turnoId: string,
    @Param('ordenId') ordenId: string,
    @Headers('x-user-id') userId: string,
  ) {
    return this.appService.deleteQuitadoLine(+turnoId, +ordenId, +userId);
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

  /** Rechaza todos los pendientes: los quita del turno y los devuelve a Sin Turnar como rechazados. */
  @Post('turnos/:turnoId/rechazar')
  rechazarTurno(
    @Param('turnoId') turnoId: string,
    @Headers('x-user-id') userId: string,
  ) {
    return this.appService.rechazarTurno(+turnoId, +userId);
  }

  /** Solo marcar: líneas → no_entregado, pedidos regresan a Sin Turnar (pueden re-turnarse). */
  @Post('turnos/:turnoId/marcar-rechazado')
  marcarRechazadoTurno(
    @Param('turnoId') turnoId: string,
    @Headers('x-user-id') userId: string,
  ) {
    return this.appService.marcarRechazadoTurno(+turnoId, +userId);
  }

  /** Permanente: líneas → no_entregado, pedidos quedan en turno (no pueden re-turnarse). */
  @Post('turnos/:turnoId/rechazar-permanente')
  rechazarPermanenteTurno(
    @Param('turnoId') turnoId: string,
    @Headers('x-user-id') userId: string,
  ) {
    return this.appService.rechazarPermanenteTurno(+turnoId, +userId);
  }

  /** Revierte el rechazo de un día (error humano): restaura líneas y re-asigna pedidos. */
  @Post('turnos/:turnoId/revertir-rechazo')
  revertirRechazoDia(
    @Param('turnoId') turnoId: string,
    @Headers('x-user-id') userId: string,
  ) {
    return this.appService.revertirRechazoDia(+turnoId, +userId);
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
