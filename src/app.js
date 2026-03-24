const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

// Import Routes
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const postRoutes = require("./routes/postRoutes");
const applicationRoutes = require("./routes/applicationRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://192.168.10.167:5173",
      "https://e-tuition-bd-client.vercel.app",
    ],
    credentials: true,
  })
);

app.get("/", (req, res) => {
  res.status(200).json({
    message: "eTuitionBD API is running 🚀",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development"
  });
});

app.use(authRoutes);
app.use(userRoutes);
app.use(postRoutes);
app.use(applicationRoutes);
app.use(paymentRoutes);
app.use(analyticsRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

app.use((err, req, res, next) => {
  console.error("Global Error Log:", err.stack);
  res.status(500).json({
    success: false,
    message: "Internal Server Error",
    error: process.env.NODE_ENV === "development" ? err.message : "Something went wrong"
  });
});

module.exports = app;