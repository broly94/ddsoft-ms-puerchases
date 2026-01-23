import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('PurchasesMain');
  const app = await NestFactory.create(AppModule);

  // Configure Redis Microservice
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.REDIS,
    options: {
      host: process.env.REDIS_HOST || 'redis',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    },
  });

  const port = process.env.PORT ?? 3000;
  
  await app.startAllMicroservices();
  await app.listen(port);
  
  logger.log(`Purchases microservice is running on: http://localhost:${port}`);
  logger.log(`Purchases microservice (Redis) is connected`);
}
bootstrap();
