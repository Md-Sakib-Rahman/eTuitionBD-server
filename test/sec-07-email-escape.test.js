const { test } = require("node:test");
const assert = require("node:assert/strict");
const h = require("./helpers/setup");
const { sendApplicationEmail, sendHiringEmail } = require("../src/utils/email");

test("SEC-07: <script> in tutor bio is escaped in the email HTML", async () => {
  h.sentMails.length = 0;
  await sendApplicationEmail("s@t.test", "Stu", {
    name: "Tut", email: "t@t.test", tutorData: { bio: "<script>alert(1)</script>" },
  }, "Math");

  assert.equal(h.sentMails.length, 1, "one mail should be captured (setup check)");
  const html = h.sentMails[0].html;
  assert.ok(!html.includes("<script>"), "raw <script> must not appear in html");
  assert.ok(html.includes("&lt;script&gt;"), "html must contain &lt;script&gt;");
});

test("SEC-07: <script> in post subject is escaped in the hire email", async () => {
  h.sentMails.length = 0;
  await sendHiringEmail("t@t.test", "Tut", { name: "Stu", email: "s@t.test" }, "<script>alert(1)</script>");

  assert.equal(h.sentMails.length, 1, "one mail should be captured (setup check)");
  const html = h.sentMails[0].html;
  assert.ok(!html.includes("<script>"), "raw <script> must not appear in html");
  assert.ok(html.includes("&lt;script&gt;"), "html must contain &lt;script&gt;");
});

test("SEC-07: tutor name with & and quotes is escaped", async () => {
  h.sentMails.length = 0;
  await sendApplicationEmail("s@t.test", "Stu", { name: `A&B "Q" O'Neil`, email: "t@t.test" }, "Math");

  const html = h.sentMails[0].html;
  assert.ok(html.includes("A&amp;B &quot;Q&quot; O&#39;Neil"), "name must be escaped");
  assert.ok(!html.includes(`A&B "Q"`), "raw name must not appear");
});

test("SEC-07: normal text is unchanged and a single & is escaped exactly once", async () => {
  h.sentMails.length = 0;
  await sendApplicationEmail("s@t.test", "Stu", {
    name: "Tut", email: "t@t.test", tutorData: { bio: "Math & Physics" },
  }, "Algebra");

  const html = h.sentMails[0].html;
  assert.ok(html.includes("Hello, Stu!"), "student name unchanged");
  assert.ok(html.includes("<strong>Name:</strong> Tut</p>"), "tutor name unchanged");
  assert.ok(html.includes('"Algebra"'), "subject unchanged");
  assert.ok(html.includes("http://client.test/student-dashboard/my-posts"), "CLIENT_URL link intact");
  assert.ok(html.includes("Math &amp; Physics"), "& escaped");
  assert.equal(html.split("&amp;").length - 1, 1, "& escaped exactly once");
  assert.ok(!html.includes("&amp;amp;"), "no double escaping");
});
