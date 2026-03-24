const express = require("express");
const router = express.Router();
const {
  createCheckoutSession,
  verifyPayment,
  completeSession,
  getAllSessions,
  getTutorSessions
} = require("../controllers/paymentController");

const { verifyToken, verifyAdmin } = require("../middleware/authMiddleware");

// All payment and escrow operations require a valid JWT session
router.use(verifyToken);

/**
 * Route to initiate a Stripe Checkout session
 * Called when a student clicks "Hire" or "Pay"
 */
router.post("/etutionbd/payment", createCheckoutSession);

/**
 * Route to verify payment success and move job to 'booked' status
 * Called after the student is redirected back from Stripe
 */
router.post("/etutionbd/payment-success", verifyPayment);

/**
 * Route to confirm tuition completion and release escrowed funds to the tutor
 * Restricted to the student who created the post
 */
router.patch("/sessions/:id/complete", completeSession);

router.get("/tutor/my-sessions", getTutorSessions);
router.get("/getallsessions", verifyAdmin, getAllSessions);



module.exports = router;