import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Types } from "mongoose";
import {
  applyPaymentIntentFailedEvent,
  getPaymentIntentFailure,
  type PaymentIntentFailure,
  type PaymentIntentFailureOutcome,
} from "../lib/checkout-payments";
import { serializeOrder } from "../lib/orders";
import type { OrderDocument } from "../models/Order";

const ORDER_ID = "64a1b2c3d4e5f67890123456";
const USER_ID = "64a1b2c3d4e5f67890123457";

function paymentIntent(overrides: Record<string, unknown> = {}) {
  return {
    id: "pi_test123456789",
    object: "payment_intent",
    livemode: false,
    metadata: { orderId: ORDER_ID, userId: USER_ID },
    last_payment_error: {
      code: "card_declined",
      decline_code: "insufficient_funds",
      message: "Sensitive provider detail must not be stored or shown.",
    },
    ...overrides,
  };
}

type TestOrder = {
  id: string;
  stripePaymentIntentId?: string;
  paymentStatus: "pending" | "failed" | "paid" | "expired";
  paymentFailureCode?: string;
  paymentFailureMessage?: string;
  inventory: number;
};

function createStore(initial?: TestOrder) {
  const orders = initial ? [initial] : [];
  const processedEventIds = new Set<string>();
  const outcomes = new Map<string, PaymentIntentFailureOutcome>();
  let tail = Promise.resolve();
  let writes = 0;

  const persist = async (eventId: string, failure: PaymentIntentFailure | null): Promise<PaymentIntentFailureOutcome> => {
    const operation = tail.then(() => {
      if (processedEventIds.has(eventId)) return "duplicate" as const;
      let outcome: PaymentIntentFailureOutcome;
      if (!failure) {
        outcome = "invalid";
      } else {
        const order = orders.find((candidate) =>
          candidate.stripePaymentIntentId === failure.id
          || (candidate.id === failure.orderId
            && (!failure.userId || failure.userId === USER_ID)
            && (!candidate.stripePaymentIntentId || candidate.stripePaymentIntentId === failure.id)),
        );
        if (!order) {
          outcome = "unmatched";
        } else if (order.paymentStatus === "paid") {
          outcome = "paid";
        } else {
          order.paymentStatus = "failed";
          order.stripePaymentIntentId = failure.id;
          order.paymentFailureCode = failure.failureCode;
          order.paymentFailureMessage = failure.failureMessage;
          writes += 1;
          outcome = "updated";
        }
      }
      processedEventIds.add(eventId);
      outcomes.set(eventId, outcome);
      return outcome;
    });
    tail = operation.then(() => undefined, () => undefined);
    return operation;
  };

  return { orders, processedEventIds, outcomes, writes: () => writes, persist };
}

describe("payment_intent.payment_failed webhook handling", () => {
  it("accepts a valid test-mode PaymentIntent and sanitizes provider details", () => {
    const failure = getPaymentIntentFailure(paymentIntent());
    assert.ok(failure);
    assert.equal(failure.id, "pi_test123456789");
    assert.equal(failure.orderId, ORDER_ID);
    assert.equal(failure.failureCode, "insufficient_funds");
    assert.equal(failure.failureMessage, "Your bank declined the payment for insufficient funds. Try another payment method.");
    assert.equal(failure.failureMessage.includes("Sensitive provider detail"), false);
  });

  it("marks the matching order failed and saves its PaymentIntent ID and safe reason", async () => {
    const store = createStore({ id: ORDER_ID, paymentStatus: "pending", inventory: 7 });
    const result = await applyPaymentIntentFailedEvent(
      { id: "evt_failure_1", paymentIntent: paymentIntent() },
      store.persist,
    );
    assert.equal(result, "updated");
    assert.equal(store.orders[0].paymentStatus, "failed");
    assert.equal(store.orders[0].stripePaymentIntentId, "pi_test123456789");
    assert.equal(store.orders[0].paymentFailureCode, "insufficient_funds");
    assert.match(store.orders[0].paymentFailureMessage ?? "", /Try another payment method/);
  });

  it("does not create an order when no association matches", async () => {
    const store = createStore();
    const result = await applyPaymentIntentFailedEvent(
      { id: "evt_unmatched", paymentIntent: paymentIntent() },
      store.persist,
    );
    assert.equal(result, "unmatched");
    assert.equal(store.orders.length, 0);
    assert.equal(store.processedEventIds.has("evt_unmatched"), true);
  });

  it("matches an order by its stored PaymentIntent ID when metadata is missing", async () => {
    const store = createStore({
      id: ORDER_ID,
      stripePaymentIntentId: "pi_test123456789",
      paymentStatus: "pending",
      inventory: 7,
    });
    const result = await applyPaymentIntentFailedEvent(
      { id: "evt_id_match", paymentIntent: paymentIntent({ metadata: {} }) },
      store.persist,
    );
    assert.equal(result, "updated");
    assert.equal(store.orders[0].paymentStatus, "failed");
  });

  it("does not repeat side effects for a duplicate delivery", async () => {
    const store = createStore({ id: ORDER_ID, paymentStatus: "pending", inventory: 7 });
    const event = { id: "evt_duplicate", paymentIntent: paymentIntent() };
    assert.equal(await applyPaymentIntentFailedEvent(event, store.persist), "updated");
    assert.equal(await applyPaymentIntentFailedEvent(event, store.persist), "duplicate");
    assert.equal(store.writes(), 1);
    assert.equal(store.processedEventIds.size, 1);
  });

  it("handles concurrent delivery of the same event exactly once", async () => {
    const store = createStore({ id: ORDER_ID, paymentStatus: "pending", inventory: 7 });
    const event = { id: "evt_concurrent", paymentIntent: paymentIntent() };
    const results = await Promise.all([
      applyPaymentIntentFailedEvent(event, store.persist),
      applyPaymentIntentFailedEvent(event, store.persist),
    ]);
    assert.deepEqual(results.sort(), ["duplicate", "updated"]);
    assert.equal(store.writes(), 1);
    assert.equal(store.processedEventIds.size, 1);
  });

  it("never overwrites a paid order or changes its inventory after a delayed failure", async () => {
    const store = createStore({
      id: ORDER_ID,
      stripePaymentIntentId: "pi_test123456789",
      paymentStatus: "paid",
      inventory: 6,
    });
    assert.equal(await applyPaymentIntentFailedEvent(
      { id: "evt_after_paid", paymentIntent: paymentIntent() },
      store.persist,
    ), "paid");
    assert.equal(store.orders[0].paymentStatus, "paid");
    assert.equal(store.orders[0].inventory, 6);
    assert.equal(store.writes(), 0);
  });

  it("handles missing or invalid PaymentIntent fields and incomplete metadata", async () => {
    const store = createStore({ id: ORDER_ID, paymentStatus: "pending", inventory: 7 });
    assert.equal(await applyPaymentIntentFailedEvent({ id: "evt_missing", paymentIntent: null }, store.persist), "invalid");
    assert.equal(await applyPaymentIntentFailedEvent(
      { id: "evt_missing_id", paymentIntent: paymentIntent({ id: undefined }) },
      store.persist,
    ), "invalid");
    assert.equal(await applyPaymentIntentFailedEvent(
      { id: "evt_missing_metadata", paymentIntent: paymentIntent({ metadata: {} }) },
      store.persist,
    ), "unmatched");
    assert.equal(await applyPaymentIntentFailedEvent(
      { id: "evt_id_only", paymentIntent: paymentIntent({ metadata: {}, id: "pi_known123" }) },
      async (_eventId, failure) => {
        assert.ok(failure);
        assert.equal(failure.orderId, undefined);
        return "unmatched";
      },
    ), "unmatched");
    assert.equal(store.orders[0].paymentStatus, "pending");
  });

  it("exposes only the safe failure message in the customer order status", () => {
    const failure = getPaymentIntentFailure(paymentIntent());
    assert.ok(failure);
    const order = serializeOrder({
      _id: new Types.ObjectId(ORDER_ID),
      userId: new Types.ObjectId(USER_ID),
      requestKey: "request",
      items: [],
      shipping: { name: "Customer", email: "customer@example.com", address: "Street", city: "City", postalCode: "12345", country: "US" },
      subtotal: 1000,
      shippingAmount: 0,
      taxAmount: 0,
      total: 1000,
      currency: "usd",
      stripePaymentIntentId: failure.id,
      paymentFailureCode: failure.failureCode,
      paymentFailureMessage: failure.failureMessage,
      paymentStatus: "failed",
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    } satisfies OrderDocument & { _id: Types.ObjectId });
    assert.equal(order.paymentFailureMessage, failure.failureMessage);
    assert.equal(order.paymentFailureMessage?.includes("Sensitive provider detail"), false);
  });

  it("does not deduct inventory for a failed payment", async () => {
    const initialInventory = 12;
    const store = createStore({ id: ORDER_ID, paymentStatus: "pending", inventory: initialInventory });
    await applyPaymentIntentFailedEvent(
      { id: "evt_no_inventory", paymentIntent: paymentIntent() },
      store.persist,
    );
    assert.equal(store.orders[0].inventory, initialInventory);
  });
});
