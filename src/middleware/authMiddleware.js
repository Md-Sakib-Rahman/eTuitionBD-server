const admin = require("firebase-admin");
const jwt = require("jsonwebtoken");
const User = require("../Models/User");

 
const verifyFirebaseAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res
      .status(401)
      .send({ message: "Unauthorized access: No token provided" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decodedUser = await admin.auth().verifyIdToken(token);
    req.decodedFirebaseUser = decodedUser;
    next();
  } catch (error) {
    console.error("Firebase Verification Error:", error);

    if (error.code === 'auth/id-token-expired') {
      return res.status(401).send({ 
        message: "Token expired", 
        code: "auth/id-token-expired" 
      });
    }

    return res.status(403).send({ message: "Forbidden access: Invalid token" });
  }
};

 
const verifyToken = (req, res, next) => {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).send({ message: "Unauthorized access: Missing session cookie" });
  }

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "Unauthorized access: Invalid or expired session" });
    }

    req.user = decoded;   
    next();
  });
};

 
const verifyAdmin = async (req, res, next) => {
  try {
    const email = req.user.email;
    const user = await User.findOne({ email });
    
    const isAdmin = user?.role === "admin";
    if (!isAdmin) {
      return res.status(403).send({ message: "Forbidden access: Admin privileges required" });
    }
    
    next();
  } catch (error) {
    console.error("Admin Verification Error:", error);
    res.status(500).send({ message: "Internal server error during authorization" });
  }
};

module.exports = {
  verifyFirebaseAuth,
  verifyToken,
  verifyAdmin,
};