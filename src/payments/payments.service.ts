import { Inject, Injectable, Logger } from '@nestjs/common';
import { envs, NATS_SERVICE } from 'src/config';
import Stripe from 'stripe';
import { PaymentSessionDto } from './dto/payment-session.dto';
import { Request, Response } from 'express';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class PaymentsService {

    private readonly stripe = new Stripe(envs.stripeSecret)

    private readonly logger = new Logger('PaymentsService')

    //- Conexion con Nats
    constructor(
        @Inject(NATS_SERVICE) private readonly client: ClientProxy
    ){}


    //?------------------------- Creamos el pago
    async createPaymentSession(paymentSessionDto: PaymentSessionDto) {

        const { currency, items, orderId } = paymentSessionDto

        const lineItems = items.map( item => {
            return {
                price_data: {
                    currency,
                    product_data: {
                        name: item.name
                    },
                    //- unit_amount cuanto cuesta
                    unit_amount: Math.round(item.price * 100), // para 20 dolares ejemplo: 2000/100 = 20.00 , Stripe no nos permite pasar valores con puntos
                },
                quantity: item.quantity
            }
        })

        const session = await this.stripe.checkout.sessions.create({
            //- Colocar aqui id de la orden
            payment_intent_data: {
                metadata: {
                    orderId: orderId
                } //- La metadata es la info adicional del registro, ejemplo, id usuario informacion de usuario etc, como para indicar que el pago lo hace tal persona
            },
            //- Arreglo de items que el usuario esta comprando
            line_items: lineItems,
            //- Modalidad, "subscription", "payment", "setup"
            mode: "payment",
            success_url: envs.stripeSuccessUrl, //- A donde nos dirigimos cuando se hace el pago
            cancel_url: envs.stripeCancelUrl //- Si algo sale mal A donde nos dirigimos cuando se hace el pago
        });

        return {
            cancelUrl: session.cancel_url,
            successUrl: session.success_url,
            url: session.url, //- url de stripe
        };
    }


    //?------------- Webhook que viene de stripe con el pago realizado
    async stripeWebhook(req: Request, res: Response) {

        //--- Cuando Stripe llama a tu webhook, incluye en los headers HTTP un campo llamado stripe-signature. 
        // Este header lo genera Stripe automáticamente y contiene una firma criptográfica (HMAC-SHA256) que se construye así: stripe-signature: t=timestamp,v1=firma_hash,...
        //- sig es la signature -> seria una firma digital en los headers
        const sig = req.headers['stripe-signature']!;

        let event: Stripe.Event;

        //- Asi encontramos el endpointSecet, en el cmd donde ejecutamos el stripe.exe ponemos -> stripe listen --forward-to localhost:3000/webhook
        //* Modo testing
        //const endpointSecret = "whsec_81856d61be6824e7a0f13ffa2bcdb31d11e2403e5d5a7d79bc2378de059458aa";
        //* real
        const endpointSecret = envs.stripeEndpointSecret;

        try {
            //-- stripe.webhooks.constructEvent() usa esa firma del sig para verificar que el request realmente viene de Stripe y no de alguien que está intentando falsificar un pago:
            event = this.stripe.webhooks.constructEvent(
                req['rawBody'], 
                sig, 
                endpointSecret
            );
        } catch (err) {
            res.status(400).send(`Webhook Error: ${err.message}`)
            return;
        }

        switch(event.type) {
            case 'charge.succeeded':
                const chargeSucceeded = event.data.object;
                const payload = {
                    stripePaymentId: chargeSucceeded.id,
                    orderId: chargeSucceeded.metadata.orderId,
                    receiptUrl: chargeSucceeded.receipt_url //- url del recivo de pago
                }
                //? Emitimos a Nats, lo tenemos en esucha en orders
                this.client.emit('payment.succeeded', payload) //- .emit a diferencia de .send es que no espera una respuesta
            break;

            default:
                console.log(`Event ${event.type} not handled`);
        }

        return res.status(200).json({sig})
    }

}
