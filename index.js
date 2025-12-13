  require("dotenv").config();
  const express = require("express");
  const app = express();
  const jwt = require("jsonwebtoken");
  const cookieParser = require("cookie-parser");
  const port = process.env.PORT || 3000;
  const cors = require("cors");
  const mongoose = require("mongoose");
  const mongoURI = process.env.MONGODB_URI;
  const User = require("./Models/User");
  const StudentPost = require("./Models/StudentPost");
  const JobApplication = require("./Models/JobApplication");
  const TuitionSession = require("./Models/TuitionSession");
  app.use(express.json());
    app.use(
      cors({
        origin: ["http://localhost:5173", "http://192.168.10.167:5173", "https://e-tuition-bd-client.vercel.app"],
        credentials: true,
      })
    );
  app.use(cookieParser());
  const admin = require("firebase-admin");

  // Stripe

  const stripe = require("stripe")(
    process.env.STRIPE_SECRET_KEY
  );

  // ??????????????????????????????

  const serviceAccountBuffer = Buffer.from(
    process.env.FIREBASE_SERVICE_ACCOUNT_BASE64,
    "base64"
  );
  const serviceAccount = JSON.parse(serviceAccountBuffer.toString("utf-8"));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  mongoose
    .connect(mongoURI)
    .then(() => console.log("connected to DB"))
    .catch((err) => console.log(err));

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
      return res.status(403).send({ message: "Forbidden access: Invalid token" });
    }
  };
  const verifyToken = (req, res, next) => {
    const token = req.cookies?.token;

    if (!token) {
      return res.status(401).send({ message: "Unauthorized access" });
    }

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
      if (err) {
        return res.status(401).send({ message: "Unauthorized access" });
      }

      req.user = decoded;

      next();
    });
  };
  const verifyAdmin = async (req, res, next) => {
    const email = req.user.email;
    const query = { email: email };
    const user = await User.findOne(query);
    const isAdmin = user?.role === "admin";
    if (!isAdmin) {
      return res.status(403).send({ message: "forbidden access" });
    }
    next();
  };

  app.post("/jwt", async (req, res) => {
    const email = req.body.email;

    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).send({ message: "Unauthorized access" });
    }
    const token = authHeader.split(" ")[1];
    try {
      const decodedUser = await admin.auth().verifyIdToken(token);
      if (decodedUser.email !== email) {
        return res.status(403).send({ message: "Forbidden access" });
      }
      const userConfig = await User.findOne({ email: email });
      const userRole = userConfig?.role || "student";

      const userForToken = {
        email: decodedUser.email,
        role: userRole,
        id: userConfig?._id,
      };
      const newToken = jwt.sign(userForToken, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res
        .cookie("token", newToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        })
        .send({ success: true });
    } catch (error) {
      console.error("Error verifying token:", error);
      res.status(403).send({ message: "Unauthorized access" });
    }
  });
  app.post("/logout", async (req, res) => {
    const user = req.body;
    console.log("logging out", user);
    res
      .clearCookie("token", { maxAge: 0, sameSite: "none", secure: true })
      .send({ success: true });
  });
  app.post("/users", verifyFirebaseAuth, async (req, res) => {
    const user = req.body;
    if (req.decodedFirebaseUser.email !== user.email) {
      return res
        .status(403)
        .send({ message: "Forbidden access: You can only register yourself" });
    }
    const query = { email: user.email };
    const existingUser = await User.findOne(query);
    if (existingUser) {
      res.send({ message: "User already exists" });
    } else {
      const userStatus = user.role === "tutor" ? "requested" : "active";
      const newUser = new User({
        ...user,
        status: userStatus,
      });
      const result = await newUser.save();
      res.send(result);
    }
  });
  app.get("/my-user", verifyToken, async (req, res) => {
    const email = req.user.email;
    const query = { email: email };
    const result = await User.findOne(query);
    res.send(result);
  });

  app.patch("/users/me", verifyToken, async (req, res) => {
    const { email, role } = req.user; // From JWT
    const updates = req.body;

    try {
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

      const query = { email: email };

      const updateDoc = {
        $set: {
          ...(updates.tutorData && { tutorData: updates.tutorData }),
          ...(updates.studentData && { studentData: updates.studentData }),

          ...(updates.name && { name: updates.name }),
          ...(updates.image && { image: updates.image }),
        },
      };

      const result = await User.updateOne(query, updateDoc);

      if (result.matchedCount === 0) {
        return res
          .status(404)
          .send({ success: false, message: "User not found" });
      }

      res.send({ success: true, message: "Profile Updated Successfully" });
    } catch (error) {
      console.error("Update Error:", error);
      res
        .status(500)
        .send({ success: false, message: "Failed to update profile" });
    }
  });

  app.post("/posts", verifyToken, async (req, res) => {
    try {
      if (req.user.role !== "student") {
        return res.status(403).send({
          success: false,
          message: "Forbidden: Only students can create tuition posts.",
        });
      }

      const student = await User.findById(req.user.id);

      if (!student) {
        return res
          .status(404)
          .send({ success: false, message: "User not found" });
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
  });

  app.get("/my-posts", verifyToken, async (req, res) => {
    try {
      if (req.user.role !== "student") {
        return res.status(403).send({
          success: false,
          message: "Forbidden: Only students can view their own posts.",
        });
      }

      const query = { studentId: req.user.id };

      const posts = await StudentPost.find(query).sort({ createdAt: -1 });

      res.send(posts);
    } catch (error) {
      console.error("Fetch Error:", error);
      res.status(500).send({ success: false, message: "Failed to fetch posts" });
    }
  });

  app.get("/posts/:id", verifyToken, async (req, res) => {
    try {
      const post = await StudentPost.findById(req.params.id).populate(
        "studentId",
        "name email image studentData"
      );

      res.send(post);
    } catch (err) {
      console.error(err);
      res.status(500).send({ message: "Error fetching post" });
    }
  });

  app.get("/posts/:postId/check-application", verifyToken, async (req, res) => {
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
  });

  app.get("/posts/:id/applications", verifyToken, async (req, res) => {
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
  });
  app.post("/apply-job", verifyToken, async (req, res) => {
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
  });

  app.put("/posts/:id", verifyToken, async (req, res) => {
    try {
      const postId = req.params.id;
      const updates = req.body;
      const userId = req.user.id;

      const post = await StudentPost.findById(postId);

      if (!post) {
        return res
          .status(404)
          .send({ success: false, message: "Post not found" });
      }

      if (post.studentId.toString() !== userId) {
        return res.status(403).send({
          success: false,
          message: "Forbidden: You can only edit your own posts.",
        });
      }

      if (post.status !== "pending" && post.status !== "active") {
        return res.status(400).send({
          success: false,
          message: "Cannot edit a post that is already booked or completed.",
        });
      }

      const allowedUpdates = {
        subject: updates.subject,
        classGrade: updates.classGrade,
        medium: updates.medium,
        duration: Number(updates.duration),
        budget: Number(updates.budget),
        description: updates.description,
      };

      Object.keys(allowedUpdates).forEach(
        (key) => allowedUpdates[key] === undefined && delete allowedUpdates[key]
      );

      const updatedPost = await StudentPost.findByIdAndUpdate(
        postId,
        { $set: allowedUpdates },
        { new: true, runValidators: true }
      );

      res.send({
        success: true,
        message: "Post updated successfully",
        post: updatedPost,
      });
    } catch (error) {
      console.error("Edit Post Error:", error);
      res.status(500).send({
        success: false,
        message: "Failed to update post.",
      });
    }
  });
  app.get("/my-applications", verifyToken, async (req, res) => {
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
  });
app.get("/public-tutors/:id", async (req, res) => {
  try {
    const id = req.params.id;

    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid Tutor ID" });
    }

    const tutor = await User.findOne({ _id: id, role: "tutor" })
      .select("-password -__v -studentData"); 

   
    if (!tutor) {
      return res.status(404).send({ message: "Tutor not found or is not active" });
    }

    res.send(tutor);
  } catch (error) {
    console.error("Public Tutor Fetch Error:", error);
    res.status(500).send({ message: "Server Error" });
  }
});
  app.get("/all-posts", async (req, res) => {
    try {
      const query = { status: "approved" };

      const posts = await StudentPost.find(query)
        .populate("studentId", "name image")
        .sort({ createdAt: -1 })
        .select("-__v");

      res.send(posts);
    } catch (error) {
      console.error("Public Feed Error:", error);
      res
        .status(500)
        .send({ success: false, message: "Failed to fetch job feed" });
    }
  });

  app.delete("/my-applications/:id", verifyToken, async (req, res) => {
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
  });

  app.patch("/applications/:id/reject", verifyToken, async (req, res) => {
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
  });
  // ADMIN ROUTES ONLY

  app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
    const result = await User.find();
    res.send(result);
  });

  app.get("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
    try {
      const id = req.params.id;

      // Find user by ID
      const user = await User.findById(id);

      if (!user) {
        return res.status(404).send({ message: "User not found" });
      }

      res.send(user);
    } catch (error) {
      console.error("Fetch User Error:", error);
      res.status(500).send({ message: "Failed to fetch user data" });
    }
  });
app.get("/all-tutors", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 8;
    const skip = (page - 1) * limit;

    const query = { role: "tutor", status: "active" };

    // 1. Get the data
    const tutors = await User.find(query)
      .select("name email image location tutorData")
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    // 2. Count total documents for pagination logic
    const total = await User.countDocuments(query);

    // 3. Send object with data AND meta info
    res.send({
      tutors,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
    });
  } catch (error) {
    console.error("Fetch Tutors Error:", error);
    res.status(500).send({ message: "Failed to fetch tutors" });
  }
});
  app.patch(
    "/users/admin-update/:id",
    verifyToken,
    verifyAdmin,
    async (req, res) => {
      try {
        const id = req.params.id;
        const { name, role, status } = req.body;

        const updateDoc = {
          $set: {
            name: name,
            role: role,
            status: status,
          },
        };

        const result = await User.updateOne({ _id: id }, updateDoc);
        res.send(result);
      } catch (error) {
        console.error("Admin Update User Error:", error);
        res.status(500).send({ message: "Failed to update user" });
      }
    }
  );

  app.delete("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
    try {
      const id = req.params.id;

      const result = await User.findByIdAndDelete(id);

      if (!result) {
        return res.status(404).send({ message: "User not found" });
      }

      res.send({ success: true, message: "User deleted successfully", result });
    } catch (error) {
      console.error("Admin Delete User Error:", error);
      res.status(500).send({ message: "Failed to delete user" });
    }
  });

  app.delete("/posts/:id", verifyToken, async (req, res) => {
    try {
      const postId = req.params.id;
      const userId = req.user.id;

      const post = await StudentPost.findById(postId);

      if (!post) {
        return res
          .status(404)
          .send({ success: false, message: "Post not found" });
      }

      if (post.studentId.toString() !== userId) {
        return res.status(403).send({
          success: false,
          message: "Forbidden: You can only delete your own posts.",
        });
      }

      if (post.status === "booked" || post.status === "completed") {
        return res.status(400).send({
          success: false,
          message: "Cannot delete a booked job. Please cancel it instead.",
        });
      }

      await StudentPost.findByIdAndDelete(postId);

      res.send({ success: true, message: "Post deleted successfully" });
    } catch (error) {
      console.error("Delete Error:", error);
      res.status(500).send({ success: false, message: "Failed to delete post" });
    }
  });

  app.get("/admin/tuitions", verifyToken, verifyAdmin, async (req, res) => {
    try {
      const result = await StudentPost.find()
        .populate("studentId", "name email image")
        .sort({ createdAt: -1 });
      res.send(result);
    } catch (error) {
      console.error("Admin Tuition Fetch Error:", error);
      res.status(500).send({ message: "Failed to fetch tuitions" });
    }
  });

  app.get("/admin/tuitions/:id", verifyToken, verifyAdmin, async (req, res) => {
    try {
      const id = req.params.id;
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
      res.status(500).send({ message: "Failed to fetch post" });
    }
  });

  app.patch("/admin/tuitions/:id", verifyToken, verifyAdmin, async (req, res) => {
    try {
      const id = req.params.id;
      const { status } = req.body; // Expecting 'approved' or 'rejected'

      // Security: Validate status
      if (!["approved", "rejected", "pending"].includes(status)) {
        return res.status(400).send({ message: "Invalid status" });
      }

      const result = await StudentPost.updateOne(
        { _id: id },
        { $set: { status: status } }
      );
      res.send(result);
    } catch (error) {
      console.error("Admin Update Error:", error);
      res.status(500).send({ message: "Failed to update status" });
    }
  });

  app.delete(
    "/admin/tuitions/:id",
    verifyToken,
    verifyAdmin,
    async (req, res) => {
      try {
        const result = await StudentPost.findByIdAndDelete(req.params.id);
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to delete post" });
      }
    }
  );





app.get("/tutor/analytics", verifyToken, async (req, res) => {
  try {
    const tutorId = req.user.id;

    if (req.user.role !== "tutor") {
      return res.status(403).send({ message: "Forbidden: Only tutors can access this." });
    }

    
    const applications = await JobApplication.find({ tutorId: tutorId }).populate('postId', 'subject');

   
    const sessions = await TuitionSession.find({ tutorId: tutorId }).populate('postId', 'subject');

   
    const totalEarnings = sessions
      .filter(s => s.status === 'completed')
      .reduce((sum, s) => sum + s.amount, 0);
      
    const pendingBalance = sessions
      .filter(s => s.status === 'ongoing')
      .reduce((sum, s) => sum + s.amount, 0);

    // Counts
    const statusCounts = {
      applied: applications.length,
      accepted: applications.filter(a => a.status === 'accepted').length,
      rejected: applications.filter(a => a.status === 'rejected').length,
      pending: applications.filter(a => a.status === 'pending').length,
    };

    const earningsData = sessions.slice(0, 5).map(s => ({
      subject: s.postId?.subject || "Unknown",
      amount: s.amount,
      status: s.status
    }));

    
    const applicationData = [
      { name: 'Pending', value: statusCounts.pending },
      { name: 'Hired', value: statusCounts.accepted },
      { name: 'Rejected', value: statusCounts.rejected },
    ];

    res.send({
      totalEarnings,
      pendingBalance,
      totalJobs: sessions.length,
      totalApplications: statusCounts.applied,
      earningsData,
      applicationData
    });

  } catch (error) {
    console.error("Tutor Analytics Error:", error);
    res.status(500).send({ message: "Failed to fetch tutor analytics" });
  }
});  

app.get("/student/stats", verifyToken, async (req, res) => {
  try {
    const studentId = req.user.id;

    if (req.user.role !== "student") {
      return res.status(403).send({ message: "Forbidden: Only students can access this." });
    }

   
    const posts = await StudentPost.find({ studentId: studentId });

   
    const sessions = await TuitionSession.find({ studentId: studentId });

   
    const totalPosts = posts.length;
    const totalSpent = sessions.reduce((sum, session) => sum + session.amount, 0);
    
   
    const statusCounts = {
      pending: posts.filter(p => p.status === 'pending').length,
      approved: posts.filter(p => p.status === 'approved').length,
      booked: posts.filter(p => p.status === 'booked').length,
      completed: posts.filter(p => p.status === 'completed').length,
    };

    
    const budgetData = posts.slice(0, 5).map(p => ({
      subject: p.subject,
      budget: p.budget
    }));

    
    const statusData = [
      { name: 'Pending', value: statusCounts.pending },
      { name: 'Active/Booked', value: statusCounts.booked + statusCounts.approved },
      { name: 'Completed', value: statusCounts.completed },
    ];

    res.send({
      totalPosts,
      totalSpent,
      totalSessions: sessions.length,
      avgBudget: totalPosts > 0 ? Math.round(posts.reduce((s, p) => s + p.budget, 0) / totalPosts) : 0,
      budgetData,
      statusData
    });

  } catch (error) {
    console.error("Student Stats Error:", error);
    res.status(500).send({ message: "Failed to fetch student stats" });
  }
});
  // Payment
app.post("/etutionbd/payment-success", verifyToken, async (req, res) => {
  try {
    const { sessionId, applicationId } = req.body;

    
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid") {
      return res.status(400).send({
        success: false,
        message: "Payment not verified. Status: " + session.payment_status,
      });
    }

    
    const application = await JobApplication.findById(applicationId).populate("postId");
    if (!application)
      return res.status(404).send({ message: "Job not found" });

   
    if (session.amount_total / 100 !== application.postId.budget) {
      return res.status(400).send({ message: "Payment amount mismatch" });
    }

   
    const existingSession = await TuitionSession.findOne({
      transactionId: sessionId,
    });
    if (existingSession) {
      return res.send({ success: true, message: "Session already active" });
    }

    
    const newSession = new TuitionSession({
      postId: application.postId._id,
      studentId: req.user.id,
      tutorId: application.tutorId,
      amount: application.postId.budget,
      transactionId: sessionId,
      status: "ongoing",
    });
    await newSession.save();

   
    await StudentPost.findByIdAndUpdate(application.postId._id, {
      status: 'booked',          
      paymentStatus: 'escrowed', 
      onboardStatus: 'onGoing',  
      assignedTutorId: application.tutorId
    });

    
    await JobApplication.findByIdAndUpdate(applicationId, {
      status: 'accepted'
    });

    
    await JobApplication.updateMany(
        { 
            postId: application.postId._id, 
            _id: { $ne: applicationId } 
        }, 
        { status: 'rejected' }
    );
    

    res.send({ success: true, message: "Payment Verified & Tuition Started!" });    
  } catch (error) {
    console.log("payment Success error:", error);
    res.status(500).send({ message: "Payment failed" });
  }
});

  app.get("/tutor/my-sessions", verifyToken, async (req, res) => {
      try {
          const tutorId = req.user.id; 

          if (req.user.role !== 'tutor') {
              return res.status(403).send({ message: "Forbidden: Only tutors can access this." });
          }

          const sessions = await TuitionSession.find({ tutorId: tutorId })
              .populate({
                  path: 'postId',
                  select: 'subject classGrade budget duration' 
              })
              .populate({
                  path: 'studentId',
                  select: 'name email image phone' // Get student contact info
              })
              .sort({ createdAt: -1 }); 

          res.send(sessions);

      } catch (error) {
          console.error("Fetch Tutor Sessions Error:", error);
          res.status(500).send({ message: "Failed to fetch sessions" });
      }
  });
  app.post("/etutionbd/payment", verifyToken, async (req, res) => {
    try {
      const user = req.user;

      

      const { applicationId } = req.body;
      const userId = req.user.id;
      const application = await JobApplication.findById({ _id: applicationId })
        .populate("postId")
        .populate("tutorId");

      if (!application) {
        return res.status(404).send({ message: "Application not found" });
      }
      if (application.postId.studentId.toString() !== userId) {
        return res.status(403).send({ message: "Forbidden access" });
      }

      const jobTitle = application.postId.subject;
      const tutorName = application.tutorId.name;
      const amount = application.postId.budget;
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "payment",
        success_url: `http://localhost:5173/student-dashboard/payment/success?session_id={CHECKOUT_SESSION_ID}&applicationId=${applicationId}`,
        cancel_url: "http://localhost:5173/cancel_page",
        customer_email: req.user.email,
        client_reference_id: application._id.toString(),

        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: jobTitle,
                description: `Tutor: ${tutorName} | Class: ${application.postId.classGrade} `,
              },
              unit_amount: Math.round(amount * 100),
            },
            quantity: 1,
          },
        ],
      });
      res.send({ url: session.url });
    } catch (err) {
      console.error("Payment Error:", err);
      res.status(500).send({ message: "Payment failed" });
    }
  });
  app.post("/etutionbd/payment-success", verifyToken, async (req, res) => {
    try {
      const { sessionId, applicationId } = req.body;
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.payment_status !== "paid") {
        return res.status(400).send({
          success: false,
          message: "Payment not verified. Status: " + session.payment_status,
        });
      }
      const application = await JobApplication.findById(applicationId).populate("postId");
      if (!application)
        return res.status(404).send({ message: " Job not found " });
      if (session.amount_total / 100 !== application.postId.budget) {
        return res.status(400).send({ message: "Payment amount mismatch" });
      }
      const existingSession = await TuitionSession.findOne({
        transactionId: sessionId,
      });
      if (existingSession) {
        return res.send({ success: true, message: "Session already active" });
      }
        

      const newSession = new TuitionSession({
        postId: application.postId._id,
        studentId: req.user.id,
        tutorId: application.tutorId,
        amount: application.postId.budget,
        transactionId: sessionId,
        status: "ongoing",
      });
      await newSession.save();
      await StudentPost.findByIdAndUpdate(application.postId._id, {
              status: 'booked',          
              paymentStatus: 'escrowed', 
              onboardStatus: 'onGoing',  
              assignedTutorId: application.tutorId
          });
      await JobApplication.findByIdAndUpdate(applicationId, {
              status: 'accepted'
          });
      res.send({ success: true, message: "Payment Verified & Tuition Started!" });    
    } catch (error) {
      console.log("payment Success error:", error);
      res.status(500).send({ message: "Payment failed" });
    }
  });
  app.get("/tutor/stats", verifyToken, async (req, res) => {
      try {
          const tutorId = req.user.id;
          const pendingSessions = await TuitionSession.find({ 
              tutorId: tutorId, 
              status: 'ongoing' 
          });

          const pendingBalance = pendingSessions.reduce((total, session) => total + session.amount, 0);
          const completedSessions = await TuitionSession.find({ 
              tutorId: tutorId, 
              status: 'completed' 
          });
          const totalEarnings = completedSessions.reduce((total, session) => total + session.amount, 0);
          res.send({
              pendingBalance,
              totalEarnings,
              activeJobCount: pendingSessions.length,
              completedJobCount: completedSessions.length
          });

      } catch (error) {
          console.error("Stats Error:", error);
          res.status(500).send({ message: "Failed to fetch stats" });
      }
  });
  app.get("/applications/:id", verifyToken, async (req, res) => {
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

      if (application.postId.studentId.toString() !== userId) {
        return res.status(403).send({ message: "Forbidden access" });
      }

      res.send(application);
    } catch (error) {
      console.error("Fetch Single App Error:", error);
      res.status(500).send({ message: "Failed to fetch application details" });
    }
  });
  app.patch("/sessions/:id/complete", verifyToken, async (req, res) => {
      try {
          const sessionId = req.params.id;
          const studentId = req.user.id; 
          const session = await TuitionSession.findById(sessionId);

          if (!session) {
              return res.status(404).send({ message: "Session not found" });
          }

          if (session.studentId.toString() !== studentId) {
              return res.status(403).send({ 
                  message: "Forbidden: Only the student can confirm completion." 
              });
          }
          if (session.status === 'completed') {
              return res.status(400).send({ message: "Session is already completed." });
          }
          session.status = 'completed';
          session.isMoneyReleased = true;
          await session.save();
          await StudentPost.findByIdAndUpdate(session.postId, {
              status: 'completed',
              paymentStatus: 'released',
              onboardStatus: 'completed'
          });
          await User.findByIdAndUpdate(session.tutorId, {
              $inc: { 
                  "tutorData.totalEarnings": session.amount,
                  "tutorData.balance": session.amount 
              }
          });

          res.send({ success: true, message: "Session completed! Funds released to tutor." });

      } catch (error) {
          console.error("Complete Session Error:", error);
          res.status(500).send({ message: "Failed to complete session" });
      }
  });

  app.get("/my-sessions", verifyToken, async (req, res) => {
      try {
          const studentId = req.user.id; 

        
          if (req.user.role !== 'student') {
              return res.status(403).send({ message: "Forbidden: Only students can access this." });
          }

        
          const sessions = await TuitionSession.find({ studentId: studentId })
              .populate({
                  path: 'postId',
                  select: 'subject classGrade budget description' 
              })
              .populate({
                  path: 'tutorId',
                  select: 'name email image'
              })
              .sort({ createdAt: -1 }); 

          res.send(sessions);

      } catch (error) {
          console.error("Fetch Sessions Error:", error);
          res.status(500).send({ message: "Failed to fetch sessions" });
      }
  });
  app.get("/getallsessions", verifyToken, async (req, res)=>{
    if(req.user.role !== "admin") return res.status(403).send({ message: "Forbidden: Only students can access this." })
    try{
      const sessions = await TuitionSession.find().populate("studentId", "name email image") 
      .populate("tutorId", "name email image")   
      .populate("postId", "subject classGrade") 
      .sort({ createdAt: -1 });                  
      res.send(sessions);
    }catch(err){
      console.log(err)
      res.status(500).send({ message: "Failed to fetch sessions" });
    }
  })
  // ???????????????
  app.get("/", (req, res) => {
    res.send("eTutionBD is running");
  });

  app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
  });
