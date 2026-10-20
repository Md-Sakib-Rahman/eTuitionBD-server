const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const h = require("./helpers/setup");
const request = require("supertest");
const TuitionSession = require("../src/Models/TuitionSession");

before(h.start);
after(h.stop);
beforeEach(h.reset);

test("DATA-01: payment-success called twice for one paid session creates one TuitionSession", async () => {
  const a = await h.seedApplication(1, 100);
  h.stripeMock.retrieve = async () => ({
    payment_status: "paid",
    client_reference_id: a.application._id.toString(),
  });
  const body = { sessionId: "cs_X", applicationId: a.application._id.toString() };

  const first = await request(h.app).post("/etutionbd/payment-success").set("Cookie", h.cookieFor(a.student)).send(body);
  assert.equal(first.status, 200, "first call should succeed (setup check)");
  await request(h.app).post("/etutionbd/payment-success").set("Cookie", h.cookieFor(a.student)).send(body);

  assert.equal(await TuitionSession.countDocuments({ transactionId: "cs_X" }), 1);
});
