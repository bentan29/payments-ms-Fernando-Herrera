import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { envs, NATS_SERVICE } from 'src/config';

@Module({
    imports: [
        ClientsModule.register([ //- Cliente que vamos a conectar
            {
                   //* Tcp normal
                // name: PRODUCT_SERVICE, //- name → token de inyección para usar el cliente después.
                // transport: Transport.TCP, //- transport: Transport.TCP → protocolo de comunicación.
                // options: {
                //   host: envs.productsMicrosericeHost,//- host → IP o dominio donde corre el microservicio.
                //   port: envs.productsMicrosericePort//- port → puerto donde está escuchando.
                // }
                    //* Con nats
                name: NATS_SERVICE, //- name → token de inyección para usar el cliente después.
                transport: Transport.NATS, //- transport: Transport.TCP → protocolo de comunicación.
                options: {
                    servers: envs.natsServers
                }
            },
        ]),
    ],
    exports: [
        ClientsModule.register([ //- Cliente que vamos a conectar
            {
                name: NATS_SERVICE, //- name → token de inyección para usar el cliente después.
                transport: Transport.NATS, //- transport: Transport.TCP → protocolo de comunicación.
                options: {
                    servers: envs.natsServers
                }
            },
        ]),
    ]
})
export class NatsModule {}
