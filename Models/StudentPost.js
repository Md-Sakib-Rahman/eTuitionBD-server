const mongoose = require("mongoose");

const StudentPostSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // --- JOB DETAILS ---
    subject: { type: String, required: true }, 
    description: { type: String, required: true }, 
    classGrade: { type: String, required: true },
    medium: { type: String, required: true  },

    // --- LOCATION (MANDATORY for Challenges) ---
    // You must keep these to pass the "Filter by Location" challenge 
    // Even for online tuition, this represents where the student is from.
    district: { type: String, required: true },
    area: { type: String, required: true },

    // --- LOGISTICS ---
    duration: {
      type: Number, 
      required: true,
    },
    budget: {
      type: Number, 
      required: true,
    },
    
    // --- WORKFLOW STATUS ---
    assignedTutorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null, 
    },
    status: {
      type: String,
      // Added 'approved' and 'rejected' for the Admin workflow 
      enum: ["pending", "approved", "rejected", "booked", "completed", "cancelled"],
      default: "pending", // 'pending' now means "Waiting for Admin Approval" [cite: 122]
    },

    // --- PAYMENT (Escrow Logic) ---
    paymentStatus: {
      type: String,
      enum: ["unpaid", "escrowed", "released", "refunded"],
      default: "unpaid",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("StudentPost", StudentPostSchema);