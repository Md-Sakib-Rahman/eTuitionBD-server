const express = require("express");
const router = express.Router();
const {
  createPost,
  getMyPosts,
  getPostById,
  getAllPublicPosts,
  updatePost,
  deletePost,
  adminGetAllTuitions,
  adminUpdatePostStatus,
  adminDeletePost,
  adminGetPostById
} = require("../controllers/postController");

const {
  verifyToken,
  verifyAdmin,
} = require("../middleware/authMiddleware");

// --- PUBLIC ROUTES ---
/**
 * Route for the public job feed (Only approved posts)
 */
router.get("/all-posts", getAllPublicPosts);

// --- PROTECTED ROUTES (Requires Login) ---
/**
 * Route to create a new tuition post
 * Middleware checks if the user is a student inside the controller
 */
router.post("/posts", verifyToken, createPost);

/**
 * Route for students to see their own created posts
 */
router.get("/my-posts", verifyToken, getMyPosts);

/**
 * Route to get details for a specific post (used for post details page)
 */
router.get("/posts/:id", verifyToken, getPostById);

/**
 * Route for students to edit their own posts
 */
router.put("/posts/:id", verifyToken, updatePost);

/**
 * Route for students to delete their own posts
 */
router.delete("/posts/:id", verifyToken, deletePost);

// --- ADMIN ROUTES (Requires Admin Role) ---
/**
 * Route for Admins to view all tuition posts in the system
 */
router.get("/admin/tuitions", verifyToken, verifyAdmin, adminGetAllTuitions);
router.get("/admin/tuitions/:id", verifyToken, verifyAdmin, adminGetPostById);
/**
 * Route for Admins to approve or reject a tuition post
 */
router.patch("/admin/tuitions/:id", verifyToken, verifyAdmin, adminUpdatePostStatus);
router.delete("/admin/tuitions/:id", verifyToken, verifyAdmin, adminDeletePost);
 
module.exports = router;