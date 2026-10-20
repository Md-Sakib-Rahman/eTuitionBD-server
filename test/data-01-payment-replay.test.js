const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const h = require("./helpers/setup");
const request = require("supertest");
const TuitionSession = require("../src/Models/TuitionSession");
const StudentPost = require("../src/Models/StudentPost");
const JobApplication = require("../src/Models/JobApplication");

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

const pay = (user, body) =>
  request(h.app).post("/etutionbd/payment-success").set("Cookie", h.cookieFor(user)).send(body);
const settle = () => new Promise((r) => setTimeout(r, 200)); // hiring email is sent fire-and-forget

test("DATA-01: replaying the same session and application returns 200 both times, one session, one email", async () => {
  await TuitionSession.init();
  const a = await h.seedApplication(1, 100);
  h.stripeMock.retrieve = async () => ({ payment_status: "paid", client_reference_id: a.application._id.toString() });
  const body = { sessionId: "cs_A", applicationId: a.application._id.toString() };

  const first = await pay(a.student, body);
  const second = await pay(a.student, body);
  await settle();

  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(second.body.success, true);
  assert.deepEqual(second.body, first.body);
  assert.equal(await TuitionSession.countDocuments({ transactionId: "cs_A" }), 1);
  assert.equal(h.sentMails.length, 1);
});

test("DATA-01: a paid session id reused for a different pending application returns 400 and creates no second session", async () => {
  await TuitionSession.init();
  const a = await h.seedApplication(1, 100);
  const b = await h.seedApplication(2, 100);
  let ref = a.application._id.toString();
  h.stripeMock.retrieve = async () => ({ payment_status: "paid", client_reference_id: ref });

  const first = await pay(a.student, { sessionId: "cs_B", applicationId: ref });
  assert.equal(first.status, 200, "first call should succeed (setup check)");
  await settle();
  const mailsAfterFirst = h.sentMails.length;

  ref = b.application._id.toString(); // Stripe reference matches b, so only the reuse check can stop it
  const reuse = await pay(b.student, { sessionId: "cs_B", applicationId: ref });
  await settle();

  assert.equal(reuse.status, 400);
  assert.equal(reuse.body.message, "This payment was already used.");
  assert.equal(await TuitionSession.countDocuments({ transactionId: "cs_B" }), 1);
  assert.equal(await TuitionSession.countDocuments(), 1);
  assert.equal(h.sentMails.length, mailsAfterFirst);
  assert.equal((await JobApplication.findById(b.application._id)).status, "pending");
});

test("DATA-01: two simultaneous identical calls create exactly one session, one email, one status write", async () => {
  await TuitionSession.init();
  const indexes = await TuitionSession.collection.indexes();
  assert.ok(
    indexes.some((i) => i.unique && i.key.transactionId === 1),
    "unique index on transactionId must exist before the race"
  );
  const a = await h.seedApplication(1, 100);
  const other = await JobApplication.create({
    postId: a.post._id, tutorId: (await h.seedApplication(9, 100)).tutor._id,
  });
  h.stripeMock.retrieve = async () => ({ payment_status: "paid", client_reference_id: a.application._id.toString() });
  const body = { sessionId: "cs_C", applicationId: a.application._id.toString() };

  let postWrites = 0;
  const origPost = StudentPost.findByIdAndUpdate;
  StudentPost.findByIdAndUpdate = function (...args) { postWrites++; return origPost.apply(this, args); };
  let appWrites = 0;
  const origApp = JobApplication.findByIdAndUpdate;
  JobApplication.findByIdAndUpdate = function (...args) { appWrites++; return origApp.apply(this, args); };
  let results;
  try {
    results = await Promise.all([pay(a.student, body), pay(a.student, body)]);
    await settle();
  } finally {
    StudentPost.findByIdAndUpdate = origPost;
    JobApplication.findByIdAndUpdate = origApp;
  }

  assert.deepEqual(results.map((r) => r.status), [200, 200]);
  assert.equal(await TuitionSession.countDocuments({ transactionId: "cs_C" }), 1);
  assert.equal(h.sentMails.length, 1);
  assert.equal(postWrites, 1);
  assert.equal(appWrites, 1);
  assert.equal((await StudentPost.findById(a.post._id)).status, "booked");
  assert.equal((await JobApplication.findById(a.application._id)).status, "accepted");
  assert.equal((await JobApplication.findById(other._id)).status, "rejected");
});

test("DATA-01: a different student reusing an already-used session id gets 400 and nothing changes", async () => {
  await TuitionSession.init();
  const a = await h.seedApplication(1, 100);
  const intruder = await h.seedApplication(2, 100);
  h.stripeMock.retrieve = async () => ({ payment_status: "paid", client_reference_id: a.application._id.toString() });
  const body = { sessionId: "cs_E", applicationId: a.application._id.toString() };

  assert.equal((await pay(a.student, body)).status, 200, "first call should succeed (setup check)");
  await settle();
  const mails = h.sentMails.length;

  const res = await pay(intruder.student, body);
  await settle();

  assert.equal(res.status, 400);
  assert.equal(res.body.message, "This payment was already used.");
  assert.equal(await TuitionSession.countDocuments(), 1);
  assert.equal(h.sentMails.length, mails);
  assert.equal((await JobApplication.findById(intruder.application._id)).status, "pending");
  assert.equal((await StudentPost.findById(intruder.post._id)).status, "approved");
  assert.equal((await StudentPost.findById(a.post._id)).status, "booked");
});

test("DATA-01: a first-time call still returns 200 and books the post", async () => {
  await TuitionSession.init();
  const a = await h.seedApplication(1, 100);
  h.stripeMock.retrieve = async () => ({ payment_status: "paid", client_reference_id: a.application._id.toString() });

  const res = await pay(a.student, { sessionId: "cs_D", applicationId: a.application._id.toString() });
  await settle();

  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(await TuitionSession.countDocuments({ transactionId: "cs_D" }), 1);
  assert.equal(h.sentMails.length, 1);
});
