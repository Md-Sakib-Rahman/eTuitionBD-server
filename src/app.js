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

// --- Global Middlewares ---
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

// --- Route Registrations ---
app.use(authRoutes);
app.use(userRoutes);
app.use(postRoutes);
app.use(applicationRoutes);
app.use(paymentRoutes);
app.use(analyticsRoutes);

// Health Check / Default Route
app.get("/", (req, res) => {
  res.send("eTuitionBD API is running in MVC mode 🚀");
});

module.exports = app;