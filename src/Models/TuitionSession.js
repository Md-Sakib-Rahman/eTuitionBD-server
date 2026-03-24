const mongoose = require("mongoose");

const TuitionSessionSchema = new mongoose.Schema(
  {
   
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StudentPost",
      required: true,
    },
   
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
   
    tutorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    
    
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: "usd"
    },
    transactionId: { 
      type: String,
      required: true
    },

   
    status: {
      type: String,
      enum: ["ongoing", "completed", "cancelled", "disputed"],
      default: "ongoing",
    },
    
    
    isMoneyReleased: {
        type: Boolean,
        default: false
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("TuitionSession", TuitionSessionSchema);