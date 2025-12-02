require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");

const app = express();
app.use(express.json());

console.log("Uri: ", process.env.MONGO_URI)

// 1) DB connection
mongoose
    .connect(process.env.MONGO_URI)
    .then(() => console.log("MongoDB connected yaar!"))
    .catch(err => console.log("MongoDB connection error:", err.message))

// 2) USER MODEL (simple schema)
const userSchema = new mongoose.Schema({
    name: String,
    age: Number
})

const User = mongoose.model("User", userSchema);

// 3) Routes

// Create User
app.post("/users", async (req, res) => {
    try {
        const user = await User.create(req.body)
        res.json(user);
    } catch (err) {
        res.status(500).send("Server Error: " + err.message);
    }
})


// Get all users
app.get("/users", async (req, res) => {
    try {
        const users = await User.find();
        res.json(users);
    } catch (err) {
        res.status(500).send("Server Error: " + err.message);
    }
})


// Get user by id
app.get("/users/:id", async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        res.json(user);
    } catch (err) {
        res.status(500).send("Server Error: ", + err.message);
    }
})


// Start Server
app.listen(5000, () => console.log("Server chal raha hai yaar!"))
