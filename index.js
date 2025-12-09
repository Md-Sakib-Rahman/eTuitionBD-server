require("dotenv").config();
const express = require("express");
const app = express();
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const port = process.env.PORT || 3000;
const cors = require("cors");
const mongoose = require("mongoose");
const mongoURI = process.env.MONGODB_URI;
const User = require("./Models/User");
const StudentPost = require("./Models/StudentPost");
const JobApplication = require("./Models/JobApplication"); 
app.use(express.json());
app.use(cors({
  origin: ['http://localhost:5173'],
  credentials: true 
}));
app.use(cookieParser());
const admin = require("firebase-admin");


const serviceAccountBuffer = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64'); 
const serviceAccount = JSON.parse(serviceAccountBuffer.toString('utf-8'));
admin.initializeApp({

  credential: admin.credential.cert(serviceAccount)

});

mongoose.connect(mongoURI)
  .then(() => console.log("connected to DB"))
  .catch((err) => console.log(err));

const verifyFirebaseAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).send({ message: 'Unauthorized access: No token provided' });
  }
  const token = authHeader.split(' ')[1];
  try {

    const decodedUser = await admin.auth().verifyIdToken(token);
    req.decodedFirebaseUser = decodedUser;
    
    next(); 
  } catch (error) {
    console.error('Firebase Verification Error:', error);
    return res.status(403).send({ message: 'Forbidden access: Invalid token' });
  }
};
const verifyToken = (req, res, next) => {
  const token = req.cookies?.token; 
  
  if (!token) {
    return res.status(401).send({ message: 'Unauthorized access' });
  }

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: 'Unauthorized access' });
    }
    
    req.user = decoded; 
    
    next();
  });
};
const verifyAdmin = async (req, res, next) => {
  const email = req.user.email;
  const query = { email: email };
  const user = await User.findOne(query);
  const isAdmin = user?.role === 'admin';
  if (!isAdmin) {
    return res.status(403).send({ message: 'forbidden access' });
  }
  next();
}


app.post("/jwt", async (req, res) => {
  
  
  const email = req.body.email;
  
  const authHeader = req.headers.authorization;        
  if (!authHeader) {
        return res.status(401).send({ message: 'Unauthorized access' });      
    }
  const token = authHeader.split(' ')[1];
  try{
    const decodedUser = await admin.auth().verifyIdToken(token);
    if(decodedUser.email !== email){
             return res.status(403).send({ message: 'Forbidden access' });
        }
    const userConfig = await User.findOne({ email: email });
    const userRole = userConfig?.role || 'student';    
    
    const userForToken = { 
            email: decodedUser.email, 
            role: userRole,   
            id: userConfig?._id 
        };
    const newToken = jwt.sign(userForToken, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
    res.cookie('token', newToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production', 
                sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
            })
            .send({ success: true });    
  } catch(error){
    console.error('Error verifying token:', error);
        res.status(403).send({ message: 'Unauthorized access' });
  } 
})
app.post('/logout', async (req, res) => {
  const user = req.body;
  console.log('logging out', user);
  res
    .clearCookie('token', { maxAge: 0, sameSite: 'none', secure: true })
    .send({ success: true });
});
app.post("/users", verifyFirebaseAuth, async (req, res) => {
  const user = req.body;
  if (req.decodedFirebaseUser.email !== user.email) {
      return res.status(403).send({ message: 'Forbidden access: You can only register yourself' });
  }
  const query = { email: user.email };
  const existingUser = await User.findOne(query);
  if (existingUser) {
    res.send({ message: "User already exists" });
  } else {
      const userStatus = user.role === 'tutor' ? 'requested' : 'active';
      const newUser = new User({
      ...user,
      status: userStatus
  });
      const result = await newUser.save();
      res.send(result);  
  }
})
app.get("/my-user", verifyToken, async (req, res) => {
    const email = req.user.email;
    const query = { email: email };
    const result = await User.findOne(query);
    res.send(result);   
})

app.patch("/users/me", verifyToken, async (req, res) => {
  const { email, role } = req.user; // From JWT
  const updates = req.body;
  
  try {
  
    if (updates.tutorData && role !== 'tutor') {
        return res.status(403).send({ 
            success: false, 
            message: "Forbidden: Students cannot update tutor profiles." 
        });
    }

   
    if (updates.studentData && role !== 'student') {
        return res.status(403).send({ 
            success: false, 
            message: "Forbidden: Tutors cannot update student profiles." 
        });
    }

   
    
    const query = { email: email };
    
    const updateDoc = {
      $set: {
       
        ...(updates.tutorData && { tutorData: updates.tutorData }),
        ...(updates.studentData && { studentData: updates.studentData }),
        
        
        ...(updates.name && { name: updates.name }),
        ...(updates.image && { image: updates.image }),
      }
    };

   
    
    const result = await User.updateOne(query, updateDoc);

    if (result.matchedCount === 0) {
      return res.status(404).send({ success: false, message: "User not found" });
    }
    
    
    res.send({ success: true, message: "Profile Updated Successfully" });

  } catch (error) {
    console.error("Update Error:", error);
    res.status(500).send({ success: false, message: "Failed to update profile" });
  }
});


app.post("/posts", verifyToken, async (req, res) => {
  try {
    
    if (req.user.role !== 'student') {
        return res.status(403).send({ 
            success: false, 
            message: "Forbidden: Only students can create tuition posts." 
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

        status: 'pending', 
        paymentStatus: 'unpaid',
        assignedTutorId: null
    });

    const result = await newPost.save();
    
    res.send({ 
        success: true, 
        message: "Job Posted Successfully", 
        post: result 
    });

  } catch (error) {
    console.error("Post Creation Error:", error);
    res.status(500).send({ 
        success: false, 
        message: "Failed to create post. Please check your inputs." 
    });
  }
});

app.get("/my-posts", verifyToken, async (req, res) => {
  try {
   
    if (req.user.role !== 'student') {
        return res.status(403).send({ 
            success: false, 
            message: "Forbidden: Only students can view their own posts." 
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
    const post = await StudentPost.findById(req.params.id)
     
      .populate("studentId", "name email image studentData"); 
      
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

        res.send({ hasApplied: !!application }); // Returns true if found, false otherwise
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
            message: "Forbidden: You are not the author of this post." 
        });
    }

   
    const applications = await JobApplication.find({ postId: postId })
        .populate("tutorId", "name email image tutorData");
        
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

        if (req.user.role !== 'tutor') {
             return res.status(403).send({ 
                 success: false, 
                 message: "Forbidden: Only tutors can apply for jobs." 
             });
        }

        const existingApplication = await JobApplication.findOne({ postId, tutorId });
        if (existingApplication) {
            return res.status(400).send({ 
                success: false, 
                message: "You have already applied for this job." 
            });
        }

        
        const newApplication = new JobApplication({
            postId: postId,
            tutorId: tutorId,
            status: 'pending' 
        });

        const result = await newApplication.save();

        res.send({ 
            success: true, 
            message: "Application submitted successfully!", 
            data: result 
        });

    } catch (error) {
        console.error("Apply Job Error:", error);
        res.status(500).send({ 
            success: false, 
            message: "Failed to submit application. Please try again." 
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
            return res.status(404).send({ success: false, message: "Post not found" });
        }

        if (post.studentId.toString() !== userId) {
            return res.status(403).send({ 
                success: false, 
                message: "Forbidden: You can only edit your own posts." 
            });
        }

        if (post.status !== 'pending' && post.status !== 'active') {
            return res.status(400).send({ 
                success: false, 
                message: "Cannot edit a post that is already booked or completed." 
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

        // Remove undefined fields (if frontend sent partial data)
        Object.keys(allowedUpdates).forEach(key => 
            allowedUpdates[key] === undefined && delete allowedUpdates[key]
        );

        // 5. Update in Database
        const updatedPost = await StudentPost.findByIdAndUpdate(
            postId, 
            { $set: allowedUpdates }, 
            { new: true, runValidators: true } 
        );

        res.send({ 
            success: true, 
            message: "Post updated successfully", 
            post: updatedPost 
        });

    } catch (error) {
        console.error("Edit Post Error:", error);
        res.status(500).send({ 
            success: false, 
            message: "Failed to update post." 
        });
    }
});
app.get("/my-applications", verifyToken, async (req, res) => {
    try {
        const tutorId = req.user.id; 

        if (req.user.role !== 'tutor') {
            return res.status(403).send({ message: "Forbidden access" });
        }

        const applications = await JobApplication.find({ tutorId: tutorId })
            .populate({
                path: 'postId',
                select: 'subject classGrade budget status studentId'
            });

        res.send(applications);

    } catch (error) {
        console.error("Fetch My Apps Error:", error);
        res.status(500).send({ message: "Failed to fetch applications" });
    }
});

app.get("/all-posts", async (req, res) => {
  try {
    
    const query = { status: 'approved' };

    const posts = await StudentPost.find(query)
      .sort({ createdAt: -1 })
      .select("-__v"); 

    res.send(posts);

  } catch (error) {
    console.error("Public Feed Error:", error);
    res.status(500).send({ success: false, message: "Failed to fetch job feed" });
  }
});


// ADMIN ROUTES ONLY

app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
    const result = await User.find();
    res.send(result);
});

app.get('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
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


app.patch("/users/admin-update/:id", verifyToken, verifyAdmin, async (req, res) => {
    try {
        const id = req.params.id;
        const { name, role, status } = req.body;
        
        const updateDoc = {
            $set: {
                name: name,    
                role: role,    
                status: status 
            }
        };

        const result = await User.updateOne({ _id: id }, updateDoc);
        res.send(result);
        
    } catch (error) {
        console.error("Admin Update User Error:", error);
        res.status(500).send({ message: "Failed to update user" });
    }
});


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
      return res.status(404).send({ success: false, message: "Post not found" });
    }

    if (post.studentId.toString() !== userId) {
      return res.status(403).send({ 
        success: false, 
        message: "Forbidden: You can only delete your own posts." 
      });
    }

    if (post.status === "booked" || post.status === "completed") {
      return res.status(400).send({ 
        success: false, 
        message: "Cannot delete a booked job. Please cancel it instead." 
      });
    }

    await StudentPost.findByIdAndDelete(postId);


    res.send({ success: true, message: "Post deleted successfully" });

  } catch (error) {
    console.error("Delete Error:", error);
    res.status(500).send({ success: false, message: "Failed to delete post" });
  }
});

app.get('/admin/tuitions', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const result = await StudentPost.find()
            .populate('studentId', 'name email image') 
            .sort({ createdAt: -1 }); 
        res.send(result);
    } catch (error) {
        console.error("Admin Tuition Fetch Error:", error);
        res.status(500).send({ message: "Failed to fetch tuitions" });
    }
});


app.get('/admin/tuitions/:id', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const id = req.params.id;
        const post = await StudentPost.findById(id).populate('studentId', 'name email image phone studentData');
        
        if (!post) {
            return res.status(404).send({ message: "Post not found" });
        }
        res.send(post);
    } catch (error) {
        console.error("Admin Post Fetch Error:", error);
        res.status(500).send({ message: "Failed to fetch post" });
    }
});


app.patch('/admin/tuitions/:id', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const id = req.params.id;
        const { status } = req.body; // Expecting 'approved' or 'rejected'
        
        // Security: Validate status
        if(!['approved', 'rejected', 'pending'].includes(status)){
             return res.status(400).send({ message: "Invalid status" });
        }

        const result = await StudentPost.updateOne({ _id: id }, { $set: { status: status } });
        res.send(result);
    } catch (error) {
        console.error("Admin Update Error:", error);
        res.status(500).send({ message: "Failed to update status" });
    }
});


app.delete('/admin/tuitions/:id', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const result = await StudentPost.findByIdAndDelete(req.params.id);
        res.send(result);
    } catch (error) {
        res.status(500).send({ message: "Failed to delete post" });
    }
});

app.get("/", (req, res) => {
  res.send("eTutionBD is running");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
