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
app.get("/", (req, res) => {
  res.send("eTutionBD is running");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
