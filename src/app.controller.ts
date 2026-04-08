import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @MessagePattern('purchases.ping')
  ping(@Payload() data: any) {
    return { message: 'pong', data };
  }

  @Get('orders')
  async findAllOrders() {
    return this.appService.findAllOrders();
  }

  @Post('orders')
  async createOrder(@Body() data: any) {
    return this.appService.createOrder(data);
  }

  @Put('orders/:id')
  async updateOrder(@Param('id') id: string, @Body() data: any) {
    return this.appService.updateOrder(+id, data);
  }

  @Delete('orders/:id')
  async deleteOrder(@Param('id') id: string) {
    return this.appService.deleteOrder(+id);
  }

  @Get('tipo-pago')
  async findAllTipoPagos() {
    return this.appService.findAllTipoPagos();
  }

  @Post('tipo-pago')
  async createTipoPago(@Body() data: any) {
    return this.appService.createTipoPago(data);
  }
}
