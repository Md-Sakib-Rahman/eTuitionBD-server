const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    role: {
      type: String,
      enum: ["student", "tutor", "admin"],
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "banned", "requested"], // 'requested' is useful for pending tutors
      default: "active",
    },
    image: {
      type: String,
      default:
        "https://img.daisyui.com/images/stock/photo-1534528741775-53994a69daeb.webp",
    },
    
    tutorData: {
      bio: { type: String },
      qualifications: { type: String },
      subjects: [String],
      hourlyRate: { type: Number },
      experience: { type: Number },
      averageRating: { type: Number, default: 0 },
      phone: { type: String }, 
      address: { type: String },
      wallet: {
        balance: { type: Number, default: 0 },       
        pendingBalance: { type: Number, default: 0 },
        totalEarnings: { type: Number, default: 0 }, 
        withdrawn: { type: Number, default: 0 }      
    }
    },
    studentData: {
      grade: { type: String },
      institute: { type: String },
      phone: { type: String }, 
      address: { type: String },
    },
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model("User", UserSchema);

module.exports = User;
