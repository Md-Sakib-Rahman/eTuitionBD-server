const StudentPost = require("../Models/StudentPost");
const User = require("../Models/User");

/**
 * Create a new tuition post
 * Restricted to users with the 'student' role
 */
const createPost = async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).send({
        success: false,
        message: "Forbidden: Only students can create tuition posts.",
      });
    }

    const student = await User.findById(req.user.id);
    if (!student) {
      return res.status(404).send({ success: false, message: "User not found" });
    }

    const newPost = new StudentPost({
      ...req.body,
      studentId: student._id,
      studentName: student.name,
      studentEmail: student.email,
      status: "pending",
      paymentStatus: "unpaid",
      assignedTutorId: null,
    });

    const result = await newPost.save();
    res.send({
      success: true,
      message: "Job Posted Successfully",
      post: result,
    });
  } catch (error) {
    console.error("Post Creation Error:", error);
    res.status(500).send({
      success: false,
      message: "Failed to create post. Please check your inputs.",
    });
  }
};

/**
 * Get all posts created by the logged-in student
 */
const getMyPosts = async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).send({
        success: false,
        message: "Forbidden: Only students can view their own posts.",
      });
    }

    const posts = await StudentPost.find({ studentId: req.user.id }).sort({ createdAt: -1 });
    res.send(posts);
  } catch (error) {
    res.status(500).send({ success: false, message: "Failed to fetch posts" });
  }
};

/**
 * Get details for a single post
 */
const getPostById = async (req, res) => {
  try {
    const post = await StudentPost.findById(req.params.id).populate(
      "studentId",
      "name email image studentData"
    );
    if (!post) return res.status(404).send({ message: "Post not found" });
    res.send(post);
  } catch (err) {
    res.status(500).send({ message: "Error fetching post" });
  }
};

/**
 * Public Feed: Get all approved tuition posts
 */
const getAllPublicPosts = async (req, res) => {
  try {
    const posts = await StudentPost.find({ status: "approved" })
      .populate("studentId", "name image")
      .sort({ createdAt: -1 })
      .select("-__v");

    res.send(posts);
  } catch (error) {
    res.status(500).send({ success: false, message: "Failed to fetch job feed" });
  }
};

/**
 * Update a tuition post
 * Only allowed if the post is still 'pending' or 'active'
 */
const updatePost = async (req, res) => {
  try {
    const postId = req.params.id;
    const updates = req.body;
    const userId = req.user.id;

    // 1. Find the post and check ownership
    const post = await StudentPost.findById(postId);
    if (!post) {
      return res.status(404).send({ success: false, message: "Post not found" });
    }

    if (post.studentId.toString() !== userId) {
      return res.status(403).send({ success: false, message: "Forbidden: You don't own this post." });
    }

    // 2. Prevent editing if the job is already locked (booked or completed)
    if (post.status === "booked" || post.status === "completed") {
      return res.status(400).send({
        success: false,
        message: "Cannot edit a post that is already booked or completed.",
      });
    }

    // 3. Prepare updated data & Reset status
    // Every edit forces a re-review by an admin
    const allowedUpdates = {
      subject: updates.subject,
      classGrade: updates.classGrade,
      medium: updates.medium,
      duration: Number(updates.duration),
      budget: Number(updates.budget),
      description: updates.description,
      status: "pending", // Reset status to pending
    };

    const updatedPost = await StudentPost.findByIdAndUpdate(
      postId,
      { $set: allowedUpdates },
      { new: true, runValidators: true }
    );

    res.send({ 
      success: true, 
      message: "Post updated and sent for re-approval.", 
      post: updatedPost 
    });
  } catch (error) {
    console.error("Update Post Error:", error);
    res.status(500).send({ success: false, message: "Failed to update post." });
  }
};

/**
 * Delete a tuition post
 */
const deletePost = async (req, res) => {
  try {
    const post = await StudentPost.findById(req.params.id);
    if (!post) return res.status(404).send({ success: false, message: "Post not found" });

    if (post.studentId.toString() !== req.user.id) {
      return res.status(403).send({ success: false, message: "Forbidden" });
    }

    if (post.status === "booked" || post.status === "completed") {
      return res.status(400).send({
        success: false,
        message: "Cannot delete a booked job. Please cancel it instead.",
      });
    }

    await StudentPost.findByIdAndDelete(req.params.id);
    res.send({ success: true, message: "Post deleted successfully" });
  } catch (error) {
    res.status(500).send({ success: false, message: "Failed to delete post" });
  }
};

// --- ADMIN CONTROLLERS ---

const adminGetAllTuitions = async (req, res) => {
  try {
    const result = await StudentPost.find()
      .populate("studentId", "name email image")
      .sort({ createdAt: -1 });
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Failed to fetch tuitions" });
  }
};

const adminUpdatePostStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!["approved", "rejected", "pending"].includes(status)) {
      return res.status(400).send({ message: "Invalid status" });
    }

    const result = await StudentPost.updateOne(
      { _id: req.params.id },
      { $set: { status } }
    );
    res.send(result);
  } catch (error) {
    res.status(500).send({ message: "Failed to update status" });
  }
};

/**
 * ADMIN: Get details for a single post
 * Includes student contact info like phone number
 */
const adminGetPostById = async (req, res) => {
  try {
    const id = req.params.id;
    // Populating student details specifically for admin view
    const post = await StudentPost.findById(id).populate(
      "studentId",
      "name email image phone studentData"
    );

    if (!post) {
      return res.status(404).send({ message: "Post not found" });
    }
    res.send(post);
  } catch (error) {
    console.error("Admin Post Fetch Error:", error);
    res.status(500).send({ message: "Failed to fetch post details" });
  }
};

/**
 * ADMIN: Delete any tuition post
 */
const adminDeletePost = async (req, res) => {
  try {
    const result = await StudentPost.findByIdAndDelete(req.params.id);
    if (!result) {
      return res.status(404).send({ message: "Post not found" });
    }
    res.send({ success: true, message: "Post deleted successfully by Admin" });
  } catch (error) {
    res.status(500).send({ message: "Failed to delete post" });
  }
};
module.exports = {
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
};