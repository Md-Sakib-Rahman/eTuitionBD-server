const StudentPost = require("../Models/StudentPost");
const TuitionSession = require("../Models/TuitionSession");
const JobApplication = require("../Models/JobApplication");

/**
 * Get stats for the Student Dashboard
 */
const getStudentStats = async (req, res) => {
  try {
    const studentId = req.user.id;

    if (req.user.role !== "student") {
      return res.status(403).send({ message: "Forbidden: Students only." });
    }

    const posts = await StudentPost.find({ studentId });
    const sessions = await TuitionSession.find({ studentId });

    const totalPosts = posts.length;
    const totalSpent = sessions.reduce((sum, s) => sum + s.amount, 0);

    const statusData = [
      { name: "Pending", value: posts.filter((p) => p.status === "pending").length },
      { name: "Active/Booked", value: posts.filter((p) => p.status === "booked" || p.status === "approved").length },
      { name: "Completed", value: posts.filter((p) => p.status === "completed").length },
    ];

    res.send({
      totalPosts,
      totalSpent,
      totalSessions: sessions.length,
      statusData,
      budgetData: posts.slice(0, 5).map(p => ({ subject: p.subject, budget: p.budget }))
    });
  } catch (error) {
    res.status(500).send({ message: "Failed to fetch student stats" });
  }
};

/**
 * Get analytics for the Tutor Dashboard
 */
const getTutorAnalytics = async (req, res) => {
  try {
    const tutorId = req.user.id;
    if (req.user.role !== "tutor") return res.status(403).send({ message: "Forbidden" });

    const applications = await JobApplication.find({ tutorId });
    const sessions = await TuitionSession.find({ tutorId });

    const totalEarnings = sessions.filter(s => s.status === "completed").reduce((sum, s) => sum + s.amount, 0);
    const pendingBalance = sessions.filter(s => s.status === "ongoing").reduce((sum, s) => sum + s.amount, 0);

    res.send({
      totalEarnings,
      pendingBalance,
      totalJobs: sessions.length,
      totalApplications: applications.length,
      applicationData: [
        { name: "Pending", value: applications.filter(a => a.status === "pending").length },
        { name: "Hired", value: applications.filter(a => a.status === "accepted").length },
        { name: "Rejected", value: applications.filter(a => a.status === "rejected").length },
      ]
    });
  } catch (error) {
    res.status(500).send({ message: "Failed to fetch tutor analytics" });
  }
};

/**
 * Get simple stats for Tutor Dashboard (Earnings & Job counts)
 */
const getTutorStats = async (req, res) => {
  try {
    const tutorId = req.user.id;

    // Fetch ongoing sessions to calculate pending balance
    const pendingSessions = await TuitionSession.find({
      tutorId: tutorId,
      status: "ongoing",
    });

    const pendingBalance = pendingSessions.reduce(
      (total, session) => total + session.amount,
      0
    );

    // Fetch completed sessions to calculate total earnings
    const completedSessions = await TuitionSession.find({
      tutorId: tutorId,
      status: "completed",
    });

    const totalEarnings = completedSessions.reduce(
      (total, session) => total + session.amount,
      0
    );

    res.send({
      pendingBalance,
      totalEarnings,
      activeJobCount: pendingSessions.length,
      completedJobCount: completedSessions.length,
    });
  } catch (error) {
    console.error("Tutor Stats Error:", error);
    res.status(500).send({ message: "Failed to fetch stats" });
  }
};

module.exports = { getStudentStats, getTutorAnalytics, getTutorStats };