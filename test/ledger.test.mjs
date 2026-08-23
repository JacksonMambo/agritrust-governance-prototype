/* AgriTrust ledger core - regression tests
   Run:  node --test test/
   Every test below fails against the v7 implementation. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const L = require("../assets/js/ledger.js");

async function seed() {
  const ledger = [];
  await L.appendEvent(ledger, "DELIVERY_CREATED", "U-FARM-01", "D00007",
    { product: "Spinach", qty: 200, uom: "bundles", gtin: "00012345678905", lot_number: "LOT-A" });
  await L.appendEvent(ledger, "DELIVERY_CREATED", "U-FARM-01", "D00006",
    { product: "Maize meal", qty: 150, uom: "bags" });
  await L.appendEvent(ledger, "DELIVERY_CONFIRMED", "U-BUY-02", "D00005", {});
  await L.appendEvent(ledger, "PAYMENT_MARKED_PAID", "U-BUY-03", "D00006", {});
  return ledger;
}

test("event data is covered by the hash (v7 regression)", async () => {
  const a = L.eventPayload("DELIVERY_CREATED", "U-FARM-01", "D00007",
    { product: "Spinach", qty: 200 }, null);
  const b = L.eventPayload("DELIVERY_CREATED", "U-FARM-01", "D00007",
    { product: "GOLD BARS", qty: 999999 }, null);
  const ha = await L.sha256Hex(L.canon(a));
  const hb = await L.sha256Hex(L.canon(b));
  assert.notEqual(ha, hb, "changing the payload must change the hash");
});

test("canonical form is order-independent", async () => {
  const x = L.canon({ data: { b: 2, a: 1 }, z: 1, a: 2 });
  const y = L.canon({ a: 2, z: 1, data: { a: 1, b: 2 } });
  assert.equal(x, y);
});

test("canonical form covers nested objects and arrays", () => {
  const c = L.canon({ data: { list: [{ b: 1, a: 2 }], n: null } });
  assert.equal(c, '{"data":{"list":[{"a":2,"b":1}],"n":null}}');
});

test("every delivery verifies PASS on clean seed data (v7 regression)", async () => {
  const ledger = await seed();
  for (const ref of ["D00007", "D00006", "D00005"]) {
    const r = await L.verifyChain(ledger, ref, false);
    assert.equal(r.status, "PASS", `${ref} failed clean: ${JSON.stringify(r.failures)}`);
  }
});

test("chains are scoped per delivery", async () => {
  const ledger = await seed();
  const d6 = L.eventsFor(ledger, "D00006");
  assert.equal(d6[0].prev_hash, null, "first event of a delivery has no predecessor");
  assert.equal(d6[1].prev_hash, d6[0].hash, "second event links to the first of the same delivery");
});

test("interleaved deliveries still verify", async () => {
  const ledger = [];
  for (let i = 0; i < 5; i++) {
    await L.appendEvent(ledger, "E" + i, "U", "D-A", { i });
    await L.appendEvent(ledger, "E" + i, "U", "D-B", { i });
  }
  assert.equal((await L.verifyChain(ledger, "D-A", false)).status, "PASS");
  assert.equal((await L.verifyChain(ledger, "D-B", false)).status, "PASS");
});

test("tampering with stored content is detected", async () => {
  const ledger = await seed();
  const target = L.eventsFor(ledger, "D00007")[0];
  target.data_json = JSON.stringify({ product: "GOLD BARS", qty: 999999 });
  const r = await L.verifyChain(ledger, "D00007", false);
  assert.equal(r.status, "FAIL");
  assert.ok(r.failures.some(f => f.reason === "HASH_MISMATCH"));
});

test("breaking the link is detected", async () => {
  const ledger = await seed();
  L.eventsFor(ledger, "D00006")[1].prev_hash = "0".repeat(64);
  const r = await L.verifyChain(ledger, "D00006", false);
  assert.ok(r.failures.some(f => f.reason === "PREV_HASH_MISMATCH"));
});

test("tamper demo mode reliably FAILs, 200 independent chains (v7 regression)", async () => {
  for (let i = 0; i < 200; i++) {
    const ledger = [];
    await L.appendEvent(ledger, "DELIVERY_CREATED", "U", "D" + i, { product: "P", qty: i });
    const r = await L.verifyChain(ledger, "D" + i, true);
    assert.equal(r.status, "FAIL", `tamper mode passed on chain ${i}`);
  }
});

test("events carry the schema version", async () => {
  const ledger = await seed();
  assert.equal(ledger[0].schema, "agritrust.ledger/8.0.0");
  assert.equal((await L.verifyChain(ledger, "D00007", false)).schema, "agritrust.ledger/8.0.0");
});

test("a hash can be recomputed from an exported record alone", async () => {
  const ledger = await seed();
  const e = ledger[0];
  const recomputed = await L.sha256Hex(L.canon(
    L.eventPayload(e.event_type, e.actor_user_id, e.delivery_ref, JSON.parse(e.data_json), e.prev_hash)
  ));
  assert.equal(recomputed, e.hash);
});
