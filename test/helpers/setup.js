// Test harness: no real network, DB, secrets or .env. Must be required before src/app.
process.env.NODE_ENV = "test";
process.env.ACCESS_TOKEN_SECRET = "test-secret";
process.env.CLIENT_URL = "http://client.test";
process.env.EMAIL_USER = "mailer@test.invalid";
process.env.STRIPE_SECRET_KEY = "sk_test_fake";

const path = require("path");
const fs = require("fs");
const os = require("os");

// 1. dotenv stub: src/utils/email.js calls require("dotenv").config(); never load a real .env.
const stub = (id, exports) => {
  const resolved = require.resolve(id);
  require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports };
};
stub("dotenv", { config: () => ({ parsed: {} }) });

// 2. Stripe stub: tests set stripeMock.retrieve.
const stripeMock = { retrieve: async () => { throw new Error("stripeMock.retrieve not set"); } };
stub("stripe", () => ({ checkout: { sessions: { retrieve: (id) => stripeMock.retrieve(id) } } }));

// 3. nodemailer stub: record mail instead of sending.
const sentMails = [];
const nodemailer = require("nodemailer");
nodemailer.createTransport = () => ({
  sendMail: async (opts) => { sentMails.push(opts); return { messageId: "test" }; },
});

// 4. firebase-admin stub: token string is the email, "bad" is rejected.
const admin = require("firebase-admin");
Object.defineProperty(admin, "auth", {
  configurable: true,
  writable: true,
  value: () => ({
    verifyIdToken: async (token) => {
      if (!token || token === "bad") throw new Error("invalid token");
      return { email: token, uid: "uid-" + token };
    },
  }),
});

// 5. In-memory Mongo using the already-cached binary (no download).
const binary = path.join(os.homedir(), ".cache", "mongodb-binaries", "mongod-x64-ubuntu-7.0.24");
if (!fs.existsSync(binary)) throw new Error("Cached mongod 7.0.24 not found; refusing to download");
process.env.MONGOMS_SYSTEM_BINARY = binary;
process.env.MONGOMS_VERSION = "7.0.24";
process.env.MONGOMS_DISABLE_POSTINSTALL = "1";

const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const { MongoMemoryServer } = require("mongodb-memory-server");
const User = require("../../src/Models/User");
const StudentPost = require("../../src/Models/StudentPost");
const JobApplication = require("../../src/Models/JobApplication");
const app = require("../../src/app");

let mongod;
const start = async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
};
const stop = async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
};
const reset = async () => {
  for (const c of Object.values(mongoose.connection.collections)) await c.deleteMany({});
  sentMails.length = 0;
};

const cookieFor = (user) =>
  "token=" + jwt.sign(
    { email: user.email, role: user.role, id: user._id.toString() },
    process.env.ACCESS_TOKEN_SECRET
  );

// student + tutor + approved post + application for it
const seedApplication = async (n, budget = 100) => {
  const student = await User.create({ name: "Stu " + n, email: `stu${n}@t.test`, role: "student" });
  const tutor = await User.create({ name: "Tut " + n, email: `tut${n}@t.test`, role: "tutor", status: "active" });
  const post = await StudentPost.create({
    studentId: student._id, subject: "Math " + n, description: "d", classGrade: "9",
    medium: "English", district: "Dhaka", area: "Mirpur", duration: 3, budget, status: "approved",
  });
  const application = await JobApplication.create({ postId: post._id, tutorId: tutor._id });
  return { student, tutor, post, application };
};

module.exports = { app, stripeMock, sentMails, start, stop, reset, cookieFor, seedApplication };
