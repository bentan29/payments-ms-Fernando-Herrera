import { Injectable } from '@nestjs/common';
import { envs } from 'src/config';
import Stripe from 'stripe';
import { PaymentSessionDto } from './dto/payment-session.dto';
import { Request, Response } from 'express';

@Injectable()
export class PaymentsService {

    private readonly stripe = new Stripe(envs.stripeSecret)


    //?-------------------------
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
                } //- La metadata es la info adicional del registro, ejmeplo, id usuario informacion de usuario etc, como para indicar que el pago lo hace tal persona
            },
            //- Arreglo de items que el usuario esta comprando
            line_items: lineItems,
            //- Modalidad, "subscription", "payment", "setup"
            mode: "payment",
            success_url: envs.stripeSuccessUrl, //- A donde nos dirigimos cuando se hace el pago
            cancel_url: envs.stripeCancelUrl //- Si algo sale mal A donde nos dirigimos cuando se hace el pago
        });

        return session;
    }


    //?-------------------------
    async stripeWebhook(req: Request, res: Response) {

        //- sig es la signature que serua una firma digital en los headers
        const sig = req.headers['stripe-signature']!;

        let event: Stripe.Event;

        //- Asi encontramos el endpointSecet, en el cmd donde ejecutamos el stripe.exe ponemos -> stripe listen --forward-to localhost:3000/webhook
        //* Modo testing
        //const endpointSecret = "whsec_81856d61be6824e7a0f13ffa2bcdb31d11e2403e5d5a7d79bc2378de059458aa";
        //* real
        const endpointSecret = envs.stripeEndpointSecret;

        try {
            event = this.stripe.webhooks.constructEvent(
                req['rawBody'], sig, endpointSecret
            );
        } catch (err) {
            res.status(400).send(`Webhook Error: ${err.message}`)
            return;
        }

        switch(event.type) {
            case 'charge.succeeded':
                const chargeSucceeded = event.data.object;
                console.log({
                    metadata: chargeSucceeded.metadata,
                    orederId: chargeSucceeded.metadata.orderId
                });
                //- llamamos a nuestro microservicio
            break;

            default:
                console.log(`Event ${event.type} not handled`);
        }

        return res.status(200).json({sig})
    }

}
