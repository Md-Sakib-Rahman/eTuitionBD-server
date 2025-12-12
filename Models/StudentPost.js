const mongoose = require("mongoose");

const StudentPostSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

   
    subject: { type: String, required: true }, 
    description: { type: String, required: true }, 
    classGrade: { type: String, required: true },
    medium: { type: String, required: true  },

   
    district: { type: String, required: true },
    area: { type: String, required: true },
    onboardStatus: {
      type: String,
      enum: ["onGoing", "completed", "waiting"],
      default: "waiting", 
    },
    
    duration: {
      type: Number, 
      required: true,
    },
    budget: {
      type: Number, 
      required: true,
    },
    
    
    assignedTutorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null, 
    },
    status: {
      type: String,
      
      enum: ["pending", "approved", "rejected", "booked", "completed", "cancelled"],
      default: "pending", 
    },

    
    paymentStatus: {
      type: String,
      enum: ["unpaid", "escrowed", "released", "refunded"],
      default: "unpaid",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("StudentPost", StudentPostSchema);