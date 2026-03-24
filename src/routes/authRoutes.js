const express = require("express");
const router = express.Router();
const { handleJWT, handleLogout } = require("../controllers/authController");

/**
 * Route to generate an internal JWT
 * Triggered after a user successfully signs in with Firebase on the frontend
 */
router.post("/jwt", handleJWT);

/**
 * Route to clear the authentication cookie
 * Logs the user out of the backend session
 */
router.post("/logout", handleLogout);

module.exports = router;