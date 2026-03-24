const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const JobApplication = require("../Models/JobApplication");
const StudentPost = require("../Models/StudentPost");
const TuitionSession = require("../Models/TuitionSession");
const User = require("../Models/User");
const { sendHiringEmail } = require("../utils/email");

/**
 * Create a Stripe Checkout Session
 * Starts the escrow process by creating a payment intent
 */
const createCheckoutSession = async (req, res) => {
  try {
    const { applicationId } = req.body;
    const userId = req.user.id;
    if (!process.env.CLIENT_URL) {
      console.error("❌ ERROR: CLIENT_URL is not defined in .env");
      return res.status(500).send({ message: "Server configuration error. Please contact admin." });
    }
    const application = await JobApplication.findById(applicationId)
      .populate("postId")
      .populate("tutorId");

    if (!application) {
      return res.status(404).send({ message: "Application not found" });
    }

    // Security: Only the student who owns the post can pay for it
    if (application.postId.studentId.toString() !== userId) {
      return res.status(403).send({ message: "Forbidden access" });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      success_url: `${process.env.CLIENT_URL}/student-dashboard/payment/success?session_id={CHECKOUT_SESSION_ID}&applicationId=${applicationId}`,
      cancel_url: `${process.env.CLIENT_URL}/cancel_page`,
      customer_email: req.user.email,
      client_reference_id: application._id.toString(),
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: application.postId.subject,
              description: `Tutor: ${application.tutorId.name} | Class: ${application.postId.classGrade}`,
            },
            unit_amount: Math.round(application.postId.budget * 100),
          },
          quantity: 1,
        },
      ],
    });

    res.send({ url: session.url });
  } catch (err) {
    console.error("Payment Error:", err);
    res.status(500).send({ message: "Failed to initialize payment" });
  }
};

/**
 * Verify Payment Success
 * Called by frontend after Stripe redirect. 
 * Creates the official TuitionSession and updates post status to 'booked'.
 */
const verifyPayment = async (req, res) => {
  try {
    const { sessionId, applicationId } = req.body;

    // 1. Verify payment status with Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid") {
      return res.status(400).send({ success: false, message: "Payment not verified." });
    }

    // 2. NESTED POPULATE (This is the fix)
    // We grab the Tutor details AND the Student details inside the Post
    const application = await JobApplication.findById(applicationId)
      .populate("tutorId", "name email") // Populates the tutor
      .populate({
        path: "postId",
        populate: { path: "studentId", select: "name email phone studentData" } // Deep populates the student
      });

    if (!application) {
      return res.status(404).send({ message: "Job application data lost." });
    }

    // --- LOGGING FOR PEACE OF MIND ---
    console.log("Recipient Email:", application.tutorId?.email);

    // 3. Create the Tuition Session (Escrow)
    const newSession = new TuitionSession({
      postId: application.postId._id,
      studentId: application.postId.studentId._id,
      tutorId: application.tutorId._id,
      amount: application.postId.budget,
      transactionId: sessionId,
      status: "ongoing",
    });
    await newSession.save();

    // 4. Update the Post Status
    await StudentPost.findByIdAndUpdate(application.postId._id, {
      status: "booked",
      paymentStatus: "escrowed",
      assignedTutorId: application.tutorId._id,
    });

    // 5. Update Application Statuses
    await JobApplication.findByIdAndUpdate(applicationId, { status: "accepted" });
    await JobApplication.updateMany(
      { postId: application.postId._id, _id: { $ne: applicationId } },
      { status: "rejected" }
    );

    // 6. SEND THE EMAIL (Recipient is now 100% defined)
    if (application.tutorId?.email) {
      sendHiringEmail(
        application.tutorId.email,
        application.tutorId.name,
        application.postId.studentId, // Full student object for contact details
        application.postId.subject
      ).catch(err => console.error("Hiring Mail Error:", err));
    }

    res.send({ success: true, message: "Tutor hired and notified!" });

  } catch (error) {
    console.error("Payment Verification Error:", error);
    res.status(500).send({ message: "Failed to verify payment." });
  }
};
/**
 * Complete Session & Release Funds
 * Triggered by the Student when they are satisfied.
 * Moves money from platform balance to Tutor balance.
 */
const completeSession = async (req, res) => {
  try {
    const sessionId = req.params.id;
    const studentId = req.user.id;
    const session = await TuitionSession.findById(sessionId);

    if (!session) return res.status(404).send({ message: "Session not found" });

    if (session.studentId.toString() !== studentId) {
      return res.status(403).send({ message: "Unauthorized: Only students can release funds." });
    }

    if (session.status === "completed") {
      return res.status(400).send({ message: "Session is already completed." });
    }

    // Release Funds logic
    session.status = "completed";
    session.isMoneyReleased = true;
    await session.save();

    await StudentPost.findByIdAndUpdate(session.postId, {
      status: "completed",
      paymentStatus: "released",
      onboardStatus: "completed",
    });

    // Increment Tutor's actual balance
    await User.findByIdAndUpdate(session.tutorId, {
      $inc: {
        "tutorData.totalEarnings": session.amount,
        "tutorData.balance": session.amount,
      },
    });

    res.send({ success: true, message: "Funds released to tutor successfully." });
  } catch (error) {
    console.error("Release Funds Error:", error);
    res.status(500).send({ message: "Failed to release funds" });
  }
};


const getAllSessions = async (req, res) => {
  try {
    // Only admins should be able to see every session
    if (req.user.role !== "admin") {
      return res.status(403).send({ message: "Forbidden: Admin access only." });
    }

    const sessions = await TuitionSession.find()
      .populate("studentId", "name email image")
      .populate("tutorId", "name email image")
      .populate("postId", "subject classGrade")
      .sort({ createdAt: -1 });

    res.send(sessions);
  } catch (err) {
    console.error("Admin Fetch All Sessions Error:", err);
    res.status(500).send({ message: "Failed to fetch all sessions" });
  }
};
/**
 * GET: Fetch all sessions for the logged-in tutor
 */
const getTutorSessions = async (req, res) => {
  try {
    const tutorId = req.user.id;

    if (req.user.role !== "tutor") {
      return res.status(403).send({ message: "Forbidden: Tutors only." });
    }

    const sessions = await TuitionSession.find({ tutorId })
      .populate({
        path: "postId",
        select: "subject classGrade budget duration",
      })
      .populate({
        path: "studentId",
        select: "name email image phone",
      })
      .sort({ createdAt: -1 });

    res.send(sessions);
  } catch (error) {
    console.error("Fetch Tutor Sessions Error:", error);
    res.status(500).send({ message: "Failed to fetch sessions" });
  }
};


/**
 * GET: Fetch all sessions for the logged-in STUDENT
 */
const getStudentSessions = async (req, res) => {
  try {
    const studentId = req.user.id;

    if (req.user.role !== "student") {
      return res.status(403).send({ message: "Forbidden: Students only." });
    }

    const sessions = await TuitionSession.find({ studentId })
      .populate({
        path: "postId",
        select: "subject classGrade budget duration",
      })
      .populate({
        path: "tutorId",
        select: "name email image phone", // Show tutor contact info
      })
      .sort({ createdAt: -1 });

    res.send(sessions);
  } catch (error) {
    console.error("Fetch Student Sessions Error:", error);
    res.status(500).send({ message: "Failed to fetch your sessions" });
  }
};

module.exports = {
  createCheckoutSession,
  verifyPayment,
  completeSession,
  getAllSessions,
  getTutorSessions,
  getStudentSessions
};