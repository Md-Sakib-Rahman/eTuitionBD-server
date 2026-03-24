const jwt = require("jsonwebtoken");
const admin = require("firebase-admin");
const User = require("../Models/User");

/**
 * Handle JWT Generation
 * Converts a valid Firebase Token into an internal app JWT
 */
const handleJWT = async (req, res) => {
  const { email } = req.body;
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).send({ message: "Unauthorized access: No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    // 1. Verify the Firebase Token
    const decodedUser = await admin.auth().verifyIdToken(token);
    
    // Security check: Ensure the requested email matches the token email
    if (decodedUser.email !== email) {
      return res.status(403).send({ message: "Forbidden access: Email mismatch" });
    }

    // 2. Fetch User Role and ID from MongoDB
    const userConfig = await User.findOne({ email });
    const userRole = userConfig?.role || "student"; // Default to student if not found
    const userId = userConfig?._id;

    // 3. Create the Internal JWT Payload
    const userForToken = {
      email: decodedUser.email,
      role: userRole,
      id: userId,
    };

    // 4. Sign and Set the Cookie
    const newToken = jwt.sign(userForToken, process.env.ACCESS_TOKEN_SECRET, {
      expiresIn: "1h",
    });

    res
      .cookie("token", newToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production", // Secure in production
        sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
      })
      .send({ success: true });

  } catch (error) {
    console.error("Error verifying token during JWT generation:", error);
    
    // Explicitly handle expired Firebase tokens
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).send({ 
        message: "Firebase token expired", 
        code: "auth/id-token-expired" 
      });
    }
    
    res.status(403).send({ message: "Unauthorized access" });
  }
};

/**
 * Handle Logout
 * Clears the HttpOnly JWT cookie
 */
const handleLogout = async (req, res) => {
  const user = req.body;
  console.log("Logging out user:", user?.email || "Unknown");

  res
    .clearCookie("token", { 
      maxAge: 0, 
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict", 
      secure: process.env.NODE_ENV === "production" 
    })
    .send({ success: true });
};

module.exports = {
  handleJWT,
  handleLogout,
};