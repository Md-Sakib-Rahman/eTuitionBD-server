const express = require("express");
const router = express.Router();
const {
  registerUser,
  getMyUser,
  updateMyProfile,
  getAllPublicTutors,
  adminGetAllUsers,
  adminUpdateUser,
  adminDeleteUser,
  getUserById,
} = require("../controllers/userController");

const {
  verifyFirebaseAuth,
  verifyToken,
  verifyAdmin,
} = require("../middleware/authMiddleware");

// --- PUBLIC ROUTES ---
/**
 * Route for public tutor browsing (paginated)
 * Accessed by: Everyone
 */
router.get("/all-tutors", getAllPublicTutors);

// --- PROTECTED ROUTES (Requires Login) ---
/**
 * Route to register/save a new user to DB
 * Uses Firebase Auth because it's the initial sign-up step
 */
router.post("/users", verifyFirebaseAuth, registerUser);

/**
 * Route to get current user data for the dashboard
 */
router.get("/my-user", verifyToken, getMyUser);

/**
 * Route to update own profile details
 */
router.patch("/users/me", verifyToken, updateMyProfile);

// --- ADMIN ROUTES (Requires Admin Role) ---
/**
 * Get all users for the Admin user management table
 */
router.get("/users", verifyToken, verifyAdmin, adminGetAllUsers);

/**
 * Update any user's role or status
 */
router.patch("/users/admin-update/:id", verifyToken, verifyAdmin, adminUpdateUser);

/**
 * Delete a user account permanently
 */
router.delete("/users/:id", verifyToken, verifyAdmin, adminDeleteUser);


// ADMIN: Route to see a specific user's overview (FIXES THE 404)
router.get("/users/:id", verifyToken, verifyAdmin, getUserById);

module.exports = router;