const User = require("../Models/User");
const mongoose = require("mongoose");

/**
 * Register or Save User to DB
 * Triggered by the saveToDB function in frontend
 */
const registerUser = async (req, res) => {
  const user = req.body;
  
  // Security check: Ensure Firebase user matches the requested email
  if (req.decodedFirebaseUser.email !== user.email) {
    return res
      .status(403)
      .send({ message: "Forbidden access: You can only register yourself" });
  }

  try {
    const query = { email: user.email };
    const existingUser = await User.findOne(query);

    if (existingUser) {
      return res.send({ message: "User already exists" });
    }

    // Assign initial status based on role
    const userStatus = user.role === "tutor" ? "requested" : "active";
    
    const newUser = new User({
      ...user,
      status: userStatus,
    });

    const result = await newUser.save();
    res.send(result);
  } catch (error) {
    console.error("Registration Error:", error);
    res.status(500).send({ message: "Internal server error during registration" });
  }
};

/**
 * Get currently authenticated user data
 */
const getMyUser = async (req, res) => {
  try {
    const email = req.user.email;
    const result = await User.findOne({ email });
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Failed to fetch user data" });
  }
};

/**
 * Update personal profile (Student or Tutor specific data)
 */
const updateMyProfile = async (req, res) => {
  const { email, role } = req.user; 
  const updates = req.body;

  try {
    // Role-based protection
    if (updates.tutorData && role !== "tutor") {
      return res.status(403).send({
        success: false,
        message: "Forbidden: Students cannot update tutor profiles.",
      });
    }

    if (updates.studentData && role !== "student") {
      return res.status(403).send({
        success: false,
        message: "Forbidden: Tutors cannot update student profiles.",
      });
    }

    const updateDoc = {
      $set: {
        ...(updates.tutorData && { tutorData: updates.tutorData }),
        ...(updates.studentData && { studentData: updates.studentData }),
        ...(updates.name && { name: updates.name }),
        ...(updates.image && { image: updates.image }),
      },
    };

    const result = await User.updateOne({ email }, updateDoc);

    if (result.matchedCount === 0) {
      return res.status(404).send({ success: false, message: "User not found" });
    }

    res.send({ success: true, message: "Profile Updated Successfully" });
  } catch (error) {
    console.error("Update Error:", error);
    res.status(500).send({ success: false, message: "Failed to update profile" });
  }
};

/**
 * Public Route: Fetch all active tutors with pagination
 */
const getAllPublicTutors = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 8;
    const skip = (page - 1) * limit;

    const query = { role: "tutor", status: "active" };

    const tutors = await User.find(query)
      .select("name email image location tutorData")
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await User.countDocuments(query);

    res.send({
      tutors,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
    });
  } catch (error) {
    console.error("Fetch Tutors Error:", error);
    res.status(500).send({ message: "Failed to fetch tutors" });
  }
};

// --- ADMIN CONTROLLERS ---

const adminGetAllUsers = async (req, res) => {
  const result = await User.find();
  res.send(result);
};

const adminUpdateUser = async (req, res) => {
  try {
    const id = req.params.id;
    const { name, role, status } = req.body;

    const updateDoc = { $set: { name, role, status } };
    const result = await User.updateOne({ _id: id }, updateDoc);
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Failed to update user" });
  }
};

const adminDeleteUser = async (req, res) => {
  try {
    const result = await User.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).send({ message: "User not found" });
    res.send({ success: true, message: "User deleted successfully" });
  } catch (error) {
    res.status(500).send({ message: "Failed to delete user" });
  }
};


/**
 * ADMIN: Get details for a specific user by ID
 */
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).select("-password"); // Never send passwords

    if (!user) {
      return res.status(404).send({ 
        success: false, 
        message: "User not found." 
      });
    }
    console.log(user)
    res.send(user);
  } catch (error) {
    console.error("Admin Fetch User Error:", error);
    res.status(500).send({ 
      success: false, 
      message: "Failed to fetch user details." 
    });
  }
};



module.exports = {
  registerUser,
  getMyUser,
  updateMyProfile,
  getAllPublicTutors,
  adminGetAllUsers,
  adminUpdateUser,
  adminDeleteUser,
  getUserById
};