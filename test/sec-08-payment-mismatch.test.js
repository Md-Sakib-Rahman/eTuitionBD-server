const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const h = require("./helpers/setup");
const request = require("supertest");
const TuitionSession = require("../src/Models/TuitionSession");

before(h.start);
after(h.stop);
beforeEach(h.reset);

test("SEC-08: payment-success with mismatched applicationId is rejected and creates no session", async () => {
  const a = await h.seedApplication(1, 10);
  const b = await h.seedApplication(2, 1000);
  h.stripeMock.retrieve = async () => ({
    payment_status: "paid",
    client_reference_id: a.application._id.toString(),
  });

  const res = await request(h.app)
    .post("/etutionbd/payment-success")
    .set("Cookie", h.cookieFor(a.student))
    .send({ sessionId: "cs_A", applicationId: b.application._id.toString() });

  assert.ok([400, 403].includes(res.status), `expected 400/403, got ${res.status}`);
  assert.equal(await TuitionSession.countDocuments(), 0, "no TuitionSession must be created");
});
