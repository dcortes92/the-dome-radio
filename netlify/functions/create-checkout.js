import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2024-11-20.acacia' });

function supabaseAdmin() {
  return createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');
}

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }
  try {
    const { priceId } = JSON.parse(event.body || '{}');
    const price = priceId || process.env.STRIPE_PRICE_ID;
    if (!price) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing priceId' }) };
    }

    // Optional: Authorization Bearer <supabase jwt>
    const auth = event.headers.authorization || event.headers.Authorization || '';
    const token = auth.replace(/^Bearer\s+/i, '');
    let customerId;
    let userId;

    if (token && process.env.SUPABASE_URL) {
      const sb = supabaseAdmin();
      const { data: userData, error } = await sb.auth.getUser(token);
      if (error || !userData?.user) {
        return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
      }
      userId = userData.user.id;
      const { data: profile } = await sb.from('profiles').select('stripe_customer_id').eq('id', userId).maybeSingle();
      customerId = profile?.stripe_customer_id;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: userData.user.email,
          metadata: { supabase_user_id: userId },
        });
        customerId = customer.id;
        await sb.from('profiles').update({ stripe_customer_id: customerId }).eq('id', userId);
      }
    }

    const origin = event.headers.origin || event.headers.referer || 'http://localhost:5173';
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price, quantity: 1 }],
      success_url: `${origin.replace(/\/$/, '')}/?checkout=success`,
      cancel_url: `${origin.replace(/\/$/, '')}/?checkout=cancel`,
      ...(customerId ? { customer: customerId } : {}),
      client_reference_id: userId,
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: session.url }),
    };
  } catch (e) {
    return { statusCode: 502, body: JSON.stringify({ error: e.message }) };
  }
}
