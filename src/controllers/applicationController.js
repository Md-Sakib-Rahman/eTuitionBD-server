const JobApplication = require("../Models/JobApplication");
const StudentPost = require("../Models/StudentPost");
const User = require("../Models/User");

/**
 * Tutor applies for a tuition post
 */
const applyToJob = async (req, res) => {
  try {
    const { postId } = req.body;
    const tutorId = req.user.id;

    if (req.user.role !== "tutor") {
      return res.status(403).send({
        success: false,
        message: "Forbidden: Only tutors can apply for jobs.",
      });
    }

    const existingApplication = await JobApplication.findOne({
      postId,
      tutorId,
    });
    if (existingApplication) {
      return res.status(400).send({
        success: false,
        message: "You have already applied for this job.",
      });
    }

    const newApplication = new JobApplication({
      postId: postId,
      tutorId: tutorId,
      status: "pending",
    });

    const result = await newApplication.save();

    res.send({
      success: true,
      message: "Application submitted successfully!",
      data: result,
    });
  } catch (error) {
    console.error("Apply Job Error:", error);
    res.status(500).send({
      success: false,
      message: "Failed to submit application. Please try again.",
    });
  }
};

/**
 * Check if a tutor has already applied to a specific post
 */
const checkApplicationStatus = async (req, res) => {
  try {
    const { postId } = req.params;
    const tutorId = req.user.id;

    const application = await JobApplication.findOne({ postId, tutorId });

    if (application) {
      res.send({
        hasApplied: true,
        status: application.status,
      });
    } else {
      res.send({
        hasApplied: false,
        status: null,
      });
    }
  } catch (error) {
    console.error("Check App Error:", error);
    res.status(500).send({ message: "Error checking application status" });
  }
};

/**
 * Get all applications for a specific post (Student view)
 */
const getPostApplications = async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user.id;

    const post = await StudentPost.findById(postId);

    if (!post) {
      return res.status(404).send({ message: "Post not found" });
    }

    if (post.studentId.toString() !== userId) {
      return res.status(403).send({
        success: false,
        message: "Forbidden: You are not the author of this post.",
      });
    }

    const applications = await JobApplication.find({ postId: postId }).populate(
      "tutorId",
      "name email image tutorData"
    );

    res.send(applications);
  } catch (err) {
    console.error("Fetch Applications Error:", err);
    res.status(500).send({ message: "Error fetching applications" });
  }
};

/**
 * Get all applications submitted by the logged-in tutor
 */
const getMyApplications = async (req, res) => {
  try {
    const tutorId = req.user.id;

    if (req.user.role !== "tutor") {
      return res.status(403).send({ message: "Forbidden access" });
    }

    const applications = await JobApplication.find({
      tutorId: tutorId,
    }).populate({
      path: "postId",
      select: "subject classGrade budget status studentId",
    });

    res.send(applications);
  } catch (error) {
    console.error("Fetch My Apps Error:", error);
    res.status(500).send({ message: "Failed to fetch applications" });
  }
};

/**
 * Tutor withdraws their application
 */
const withdrawApplication = async (req, res) => {
  try {
    const applicationId = req.params.id;
    const tutorId = req.user.id;

    const application = await JobApplication.findOne({
      _id: applicationId,
      tutorId: tutorId,
    });

    if (!application) {
      return res
        .status(404)
        .send({ success: false, message: "Application not found" });
    }

    if (application.status === "accepted") {
      return res.status(400).send({
        success: false,
        message: "Cannot cancel an application after you have been hired.",
      });
    }

    await JobApplication.findByIdAndDelete(applicationId);

    res.send({ success: true, message: "Application withdrawn successfully" });
  } catch (error) {
    console.error("Delete App Error:", error);
    res
      .status(500)
      .send({ success: false, message: "Failed to withdraw application" });
  }
};

/**
 * Student rejects a specific application
 */
const rejectApplication = async (req, res) => {
  try {
    const applicationId = req.params.id;
    const userId = req.user.id;

    const application = await JobApplication.findById(applicationId).populate(
      "postId"
    );

    if (!application) {
      return res.status(404).send({ message: "Application not found" });
    }

    if (application.postId.studentId.toString() !== userId) {
      return res
        .status(403)
        .send({ message: "Forbidden: You do not own this post." });
    }

    application.status = "rejected";
    await application.save();

    res.send({ success: true, message: "Application rejected" });
  } catch (error) {
    console.error("Reject App Error:", error);
    res.status(500).send({ message: "Failed to reject application" });
  }
};

/**
 * Get single application details
 */
const getApplicationById = async (req, res) => {
  try {
    const applicationId = req.params.id;
    const userId = req.user.id;

    const application = await JobApplication.findById(applicationId)
      .populate({
        path: "postId",
        select: "subject classGrade budget studentId",
      })
      .populate({
        path: "tutorId",
        select: "name email image",
      });

    if (!application) {
      return res.status(404).send({ message: "Application not found" });
    }

    // Allow the student who owns the post OR the tutor who applied to see it
    const isOwner = application.postId.studentId.toString() === userId;
    const isApplicant = application.tutorId._id.toString() === userId;

    if (!isOwner && !isApplicant) {
      return res.status(403).send({ message: "Forbidden access" });
    }

    res.send(application);
  } catch (error) {
    console.error("Fetch Single App Error:", error);
    res.status(500).send({ message: "Failed to fetch application details" });
  }
};

module.exports = {
  applyToJob,
  checkApplicationStatus,
  getPostApplications,
  getMyApplications,
  withdrawApplication,
  rejectApplication,
  getApplicationById,
};