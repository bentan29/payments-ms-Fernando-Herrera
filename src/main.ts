import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { envs } from './config';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

async function bootstrap() {

  const logger = new Logger('Payments-ms')

  // 1. Crea la app HTTP, osea comun para recibir GET POST PUT DELETE ...
  const app = await NestFactory.create(AppModule, {
    rawBody: true
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true
    })
  )

  // 2. Registra el microservicio NATS (aún no inicia)
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.NATS,
    options: {
      servers: envs.natsServers
    }
  }, {inheritAppConfig: true}) //- esta parte permite retornar los errores al ser un microservicio hibrido

  // 3. Inicia TODOS los microservicios conectados (NATS en este caso)
  //- Sin esto nunca se conectará, y nuestros @MessagePattern y @EventPattern nunca recibirán mensajes.
  await app.startAllMicroservices();

  // 4. Inicia el servidor HTTP
  await app.listen(envs.port);

  logger.log(`Payments Microservices runnning on port ${envs.port}`)



}

bootstrap();
