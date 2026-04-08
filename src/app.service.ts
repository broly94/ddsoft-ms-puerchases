import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrdenCompraHeader } from './entities/orden-compra-header.entity';
import { TipoPago } from './entities/tipo-pago.entity';

@Injectable()
export class AppService {
  constructor(
    @InjectRepository(OrdenCompraHeader)
    private ordenCompraRepository: Repository<OrdenCompraHeader>,
    @InjectRepository(TipoPago)
    private tipoPagoRepository: Repository<TipoPago>,
  ) {}

  getHello(): string {
    return 'Hello from Purchases Microservice!';
  }

  // Orden Compra Header
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
    if (!order) throw new NotFoundException(`Order with ID ${id} not found`);
    
    Object.assign(order, data);
    return this.ordenCompraRepository.save(order);
  }

  async deleteOrder(id: number) {
    const result = await this.ordenCompraRepository.delete(id);
    if (result.affected === 0) throw new NotFoundException(`Order with ID ${id} not found`);
    return { success: true };
  }

  // Tipo Pago
  async findAllTipoPagos() {
    return this.tipoPagoRepository.find();
  }

  async createTipoPago(data: Partial<TipoPago>) {
    const tipoPago = this.tipoPagoRepository.create(data);
    return this.tipoPagoRepository.save(tipoPago);
  }
}
