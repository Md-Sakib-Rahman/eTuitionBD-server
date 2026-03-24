const express = require("express");
const router = express.Router();
const {
  applyToJob,
  checkApplicationStatus,
  getPostApplications,
  getMyApplications,
  withdrawApplication,
  rejectApplication,
  getApplicationById,
} = require("../controllers/applicationController");

const { verifyToken } = require("../middleware/authMiddleware");

// All application routes require a valid session/JWT
router.use(verifyToken);

/**
 * Route for tutors to apply for a specific job
 */
router.post("/apply-job", applyToJob);

/**
 * Route for tutors to see if they have already applied to a post
 * Used to disable the "Apply" button on the UI
 */
router.get("/posts/:postId/check-application", checkApplicationStatus);

/**
 * Route for students to see everyone who applied to their specific post
 */
router.get("/posts/:id/applications", getPostApplications);

/**
 * Route for tutors to see all jobs they have applied for
 */
router.get("/my-applications", getMyApplications);

/**
 * Route for tutors to cancel/withdraw a pending application
 */
router.delete("/my-applications/:id", withdrawApplication);

/**
 * Route for students to reject a specific tutor application
 */
router.patch("/applications/:id/reject", rejectApplication);

/**
 * Route to get details for a single application
 */
router.get("/applications/:id", getApplicationById);

module.exports = router;