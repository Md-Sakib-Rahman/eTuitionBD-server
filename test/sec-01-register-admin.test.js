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
});
