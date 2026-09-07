import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const config = { runtime: "edge" };

export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  const subscription = event.data.object;
  console.log("Event type:", event.type);
  console.log("Subscription ID:", subscription.id);
  console.log("Subscription metadata:", JSON.stringify(subscription.metadata));

  if (event.type === "customer.subscription.created") {
    const customerId = subscription.customer;

    // checkoutセッションからuserIdを取得
    const sessions = await stripe.checkout.sessions.list({
      subscription: subscription.id,
      limit: 1,
    });
    console.log("Sessions count:", sessions.data.length);
    const userId = sessions.data[0]?.metadata?.userId;
    console.log("UserId from session:", userId);

    if (userId) {
      const { error } = await supabase.from("subscriptions").upsert({
        user_id: userId,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscription.id,
        status: "active",
        current_period_end: subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000).toISOString()
          : null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      console.log("Supabase upsert error:", error);
    } else {
      console.log("No userId found - skipping upsert");
    }
  }

  if (event.type === "customer.subscription.deleted") {
    await supabase.from("subscriptions")
      .update({ status: "inactive", updated_at: new Date().toISOString() })
      .eq("stripe_subscription_id", subscription.id);
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
