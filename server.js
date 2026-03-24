require("dotenv").config();
const admin = require("firebase-admin");
const connectDB = require("./src/config/db");
const app = require("./src/app");

const port = process.env.PORT || 3000;

if (!admin.apps.length) {  
  try {
    const base64String = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
    if (!base64String) throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_BASE64");

    const serviceAccount = JSON.parse(
      Buffer.from(base64String, "base64").toString("utf-8")
    );

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log("  Firebase Admin Initialized");
  } catch (error) {
    console.error("  Firebase Initialization Error:", error.message);
  }
}

connectDB().then(() => {
  app.listen(port, () => {
    console.log(`  Server listening on port ${port}`);
  });
});