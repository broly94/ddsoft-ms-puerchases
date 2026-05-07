import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppService } from './app.service';
import { AppController } from './app.controller';
import { SearchModule } from './search/search.module';
import { PdfImportService } from './analysis/pdf-import.service';
import { OrdenCompraHeader } from './entities/orden-compra-header.entity';
import { PedidoHistorico } from './entities/pedido-historico.entity';
import { TipoPago } from './entities/tipo-pago.entity';
import { TurnoConfig } from './entities/turno-config.entity';
import { TurnoHeader } from './entities/turno-header.entity';
import { Turno } from './entities/turno.entity';
import { BillingType } from './entities/billing-type.entity';
import { PurchasesProvider } from './entities/purchases-provider.entity';
import { ProviderBillingType } from './entities/provider-billing-type.entity';
import { ProductBillingAssignment } from './entities/product-billing-assignment.entity';
import { ProvidersController } from './providers/providers.controller';
import { ProvidersService } from './providers/providers.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST', 'db_purchases'),
        port: configService.get<number>('DB_PORT', 5432),
        username: configService.get<string>('DB_USER'),
        password: configService.get<string>('DB_PASS'),
        database: configService.get<string>('DB_NAME'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: configService.get<string>('NODE_ENV') !== 'production',
      }),
    }),
    TypeOrmModule.forFeature([
      OrdenCompraHeader, PedidoHistorico, TipoPago, TurnoConfig, TurnoHeader, Turno,
      BillingType, PurchasesProvider, ProviderBillingType, ProductBillingAssignment,
    ]),
    SearchModule,
  ],
  controllers: [AppController, ProvidersController],
  providers: [AppService, PdfImportService, ProvidersService],
})
export class AppModule {}
