import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { mapSubscriptionToProfile } from './lib/subscription-map.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2024-11-20.acacia' });

function supabaseAdmin() {
  return createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');
}

export async function handler(event) {
  const sig = event.headers['stripe-signature'] || event.headers['Stripe-Signature'];
  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET || '',
    );
  } catch (err) {
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  const sb = supabaseAdmin();

  try {
    if (stripeEvent.type === 'checkout.session.completed') {
      const session = stripeEvent.data.object;
      const userId = session.client_reference_id;
      const customerId = session.customer;
      if (userId) {
        await sb
          .from('profiles')
          .update({
            stripe_customer_id: customerId,
            subscription_status: 'active',
          })
          .eq('id', userId);
      }
    }

    if (
      stripeEvent.type === 'customer.subscription.updated' ||
      stripeEvent.type === 'customer.subscription.deleted'
    ) {
      const sub = stripeEvent.data.object;
      const patch = mapSubscriptionToProfile(sub);
      const customerId = sub.customer;
      await sb.from('profiles').update(patch).eq('stripe_customer_id', customerId);
    }

    if (stripeEvent.type === 'invoice.payment_failed') {
      const invoice = stripeEvent.data.object;
      await sb
        .from('profiles')
        .update({ subscription_status: 'past_due' })
        .eq('stripe_customer_id', invoice.customer);
    }
  } catch (e) {
    return { statusCode: 500, body: e.message };
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
}
