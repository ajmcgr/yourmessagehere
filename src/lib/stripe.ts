import { loadStripe, type Stripe } from "@stripe/stripe-js";

/**
 * Publishable key only — the secret key lives exclusively in Supabase Edge
 * Function secrets and is never shipped to the browser.
 */
const key = import.meta.env['VITE_STRIPE_PUBLISHABLE_KEY'] as string | undefined;

export const isStripeConfigured = Boolean(key);

let promise: Promise<Stripe | null> | null = null;

export function getStripe(): Promise<Stripe | null> {
  if (!key) return Promise.resolve(null);
  if (!promise) promise = loadStripe(key);
  return promise;
}
