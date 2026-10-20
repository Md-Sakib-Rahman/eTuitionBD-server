const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const h = require("./helpers/setup");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const User = require("../src/Models/User");
const StudentPost = require("../src/Models/StudentPost");
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

const paidFor = (applicationId) => {
  h.stripeMock.retrieve = async () => ({
    payment_status: "paid",
    client_reference_id: applicationId.toString(),
  });
};

const pay = (cookie, applicationId) =>
  request(h.app)
    .post("/etutionbd/payment-success")
    .set("Cookie", cookie)
    .send({ sessionId: "cs_X", applicationId: applicationId.toString() });

test("SEC-08: a different student with a matching session is rejected with 400 and creates no session", async () => {
  const a = await h.seedApplication(1, 10);
  const other = await User.create({ name: "Other", email: "other@t.test", role: "student" });
  paidFor(a.application._id);

  const res = await pay(h.cookieFor(other), a.application._id);

  assert.equal(res.status, 400);
  assert.equal(await TuitionSession.countDocuments(), 0, "no TuitionSession must be created");
});

test("SEC-08: a post that is not approved is rejected with 400 and creates no session", async () => {
  const a = await h.seedApplication(1, 10);
  await StudentPost.findByIdAndUpdate(a.post._id, { status: "booked" });
  paidFor(a.application._id);

  const res = await pay(h.cookieFor(a.student), a.application._id);

  assert.equal(res.status, 400);
  assert.equal(await TuitionSession.countDocuments(), 0, "no TuitionSession must be created");
});

test("SEC-08: a token without an id is rejected with 400 and creates no session", async () => {
  const a = await h.seedApplication(1, 10);
  paidFor(a.application._id);
  const cookie = "token=" + jwt.sign(
    { email: a.student.email, role: a.student.role },
    process.env.ACCESS_TOKEN_SECRET
  );

  const res = await pay(cookie, a.application._id);

  assert.equal(res.status, 400);
  assert.equal(await TuitionSession.countDocuments(), 0, "no TuitionSession must be created");
});

test("SEC-08: the matching owner, session and approved post still returns 200 and creates one session", async () => {
  const a = await h.seedApplication(1, 10);
  paidFor(a.application._id);

  const res = await pay(h.cookieFor(a.student), a.application._id);

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(await TuitionSession.countDocuments(), 1);
});
