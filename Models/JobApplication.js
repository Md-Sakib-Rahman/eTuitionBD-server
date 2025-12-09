const mongoose = require("mongoose");

const JobApplicationSchema = new mongoose.Schema(
  {
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StudentPost",
      required: true,
    },
    tutorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("JobApplication", JobApplicationSchema);