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
    const auth = event.headers.authorization || event.headers.Authorization || '';
    const token = auth.replace(/^Bearer\s+/i, '');
    if (!token) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
    }
    const sb = supabaseAdmin();
    const { data: userData, error } = await sb.auth.getUser(token);
    if (error || !userData?.user) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
    }
    const { data: profile } = await sb
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', userData.user.id)
      .maybeSingle();
    if (!profile?.stripe_customer_id) {
      return { statusCode: 404, body: JSON.stringify({ error: 'No Stripe customer' }) };
    }
    const origin = event.headers.origin || 'http://localhost:5173';
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: origin.replace(/\/$/, ''),
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
