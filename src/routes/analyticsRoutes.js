const express = require("express");
const router = express.Router();
const { getStudentStats, getTutorAnalytics, getTutorStats } = require("../controllers/analyticsController");
const { verifyToken } = require("../middleware/authMiddleware");

router.get("/student/stats", verifyToken, getStudentStats);
router.get("/tutor/analytics", verifyToken, getTutorAnalytics);
router.get("/tutor/stats", getTutorStats);
module.exports = router;