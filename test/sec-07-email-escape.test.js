const { test } = require("node:test");
const assert = require("node:assert/strict");
const h = require("./helpers/setup");
const { sendApplicationEmail } = require("../src/utils/email");

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
