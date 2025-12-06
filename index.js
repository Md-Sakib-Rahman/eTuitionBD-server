require("dotenv").config();
const express = require("express");
const app = express();
const port = process.env.PORT || 3000;
const cors = require("cors");
const mongoose = require("mongoose");
const mongoURI = process.env.MONGODB_URI;

app.use(express.json());
app.use(cors());


  mongoose.connect(mongoURI)
  .then(() => console.log("connected to DB"))
  .catch((err) => console.log(err));
app.get("/", (req, res) => {
  res.send("eTutionBD is running");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
