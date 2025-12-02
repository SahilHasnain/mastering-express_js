require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose")

const app = express();
app.use(express.json())

// MongoDB connection
mongoose
    .connect(process.env.MONGO_URI)
    .then(() => console.log("MOngoDB connected yaar!"))
    .catch(err => console.log("DB error:", err.message))

// User Schema with validation

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true, // validation 
    },
    age: {
        type: Number,
        required: true,
        min: 1,                 // validation
    },
    email: {
        type: String,
        required: true,
        unique: true,
    }
})

// User Model

const User = mongoose.model("User", userSchema);

// custom middleware for user validation
async function validateUserId(req, res, next) {
    try {
        const id = req.params.id;
        if (!id) res.status(400).send("id required yaar!");

        const user = await User.findById(id);

        if (!user) res.status(404).send("User not found yaar!")

        req.user = user
        next();
    } catch (err) {
        res.staus(500).send("Validation Error: " + err.message)
    }

}

// Routes

// Create User
app.post("/users", async (req, res) => {
    try {
        const user = await User.create(req.body);
        res.status(201).json(user);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
})

// Read Users
app.get("/users", async (req, res) => {
    try {
        const users = await User.find();
        res.json(users);
    } catch (err) {
        res.status(500).json({ message: err.message })
    }
})

// Read a user by id
app.get("/users/:id", async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        res.json(user)
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
})

// Update User (PUT = full update)
app.put("/users/:id", (req, res) => {
    try {
        const updated = User.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        )

        res.json(updated);
    } catch (err) {
        res.status(500).json({ message: err.message })
    }
})

// Update User (Patch = Partial Update)
app.patch("/users/:id", async (req, res) => {
    try {
        const updated = await User.findByIdAndUpdate(
            req.params.id,
            req.body,
            {
                new: true,
                runValidators: true,
            }
        )
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
})

// Delete User
app.delete("/users/:id", async (req, res) => {
    try {
        await User.findByIdAndDelete(req.params.id)
        res.send("user delete ho gaya yaar");
    } catch (err) {
        res.status(500).send("Failed to delete user, error: " + err.message);
    }
})

// Error Handler
app.use((err, req, res, next) => {
    res.status(500).send("Server Error: " + err.message)
})




