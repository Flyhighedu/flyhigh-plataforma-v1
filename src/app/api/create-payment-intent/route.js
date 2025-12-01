import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(request) {
    try {
        const { childCount } = await request.json();

        // Calculate amount on server side: childCount * 4000 (cents)
        // Assuming currency is MXN based on context (Uruapan)
        const amount = childCount * 4000;

        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount,
            currency: 'mxn',
            automatic_payment_methods: {
                enabled: true,
            },
        });

        return NextResponse.json({ clientSecret: paymentIntent.client_secret });
    } catch (error) {
        console.error('Internal Error:', error);
        return NextResponse.json(
            { error: `Internal Server Error: ${error.message}` },
            { status: 500 }
        );
    }
}
