const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const h = require("./helpers/setup");
const request = require("supertest");
const User = require("../src/Models/User");

before(h.start);
after(h.stop);
beforeEach(h.reset);

test("SEC-01: POST /users with role admin must not create an admin", async () => {
  const res = await request(h.app)
    .post("/users")
    .set("Authorization", "Bearer a@x.com")
    .send({ name: "A", email: "a@x.com", role: "admin" });

  assert.ok(res.status < 500, `expected non-5xx, got ${res.status}`);
  const stored = await User.findOne({ email: "a@x.com" });
  assert.notEqual(stored?.role, "admin", `stored role must not be "admin" (status ${res.status})`);
  assert.equal(res.status, 400, "invalid role must be answered with 400 (never 401/403)");
  assert.equal(stored, null, "no user must be stored for a rejected role");
});

const register = (body) =>
  request(h.app).post("/users").set("Authorization", `Bearer ${body.email}`).send(body);

test("SEC-01: missing role is answered with 400 and creates no user", async () => {
  const res = await register({ name: "A", email: "a@x.com" });
  assert.equal(res.status, 400);
  assert.ok(res.body.message, "400 response must carry a message");
  assert.equal(await User.countDocuments(), 0);
});

test("SEC-01: unknown role is answered with 400 and creates no user", async () => {
  const res = await register({ name: "A", email: "a@x.com", role: "superuser" });
  assert.equal(res.status, 400);
  assert.equal(await User.countDocuments(), 0);
});

test("SEC-01: role tutor still creates a tutor with status requested", async () => {
  const res = await register({ name: "T", email: "t@x.com", role: "tutor", phone: "0123" });
  assert.equal(res.status, 200);
  const stored = await User.findOne({ email: "t@x.com" }).lean();
  assert.equal(stored.role, "tutor");
  assert.equal(stored.status, "requested");
  assert.equal(stored.phone, "0123");
});

test("SEC-01: role student still creates an active student", async () => {
  const res = await register({ name: "S", email: "s@x.com", role: "student", image: "http://img.test/s.png" });
  assert.equal(res.status, 200);
  const stored = await User.findOne({ email: "s@x.com" }).lean();
  assert.equal(stored.role, "student");
  assert.equal(stored.status, "active");
  assert.equal(stored.image, "http://img.test/s.png");
});

test("SEC-01: status, tutorData and studentData in the body are ignored", async () => {
  const res = await register({
    name: "S", email: "s@x.com", role: "student",
    status: "banned", tutorData: { bio: "injected" }, studentData: { grade: "injected" },
  });
  assert.equal(res.status, 200);
  const stored = await User.findOne({ email: "s@x.com" }).lean();
  assert.equal(stored.status, "active");
  assert.equal(stored.tutorData?.bio, undefined, "caller-supplied tutorData must not be stored");
  assert.equal(stored.studentData?.grade, undefined, "caller-supplied studentData must not be stored");
});
