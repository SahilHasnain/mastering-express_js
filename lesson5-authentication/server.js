require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

// Connect MongoDB
mongoose
    .connect(process.env.MONG_URI)
    .then(() => console.log("MongoDB connected yaar!"))
    .catch(err => console.log("DB error:", err.message))

// User Schema + Model
const userSchema = new mongoose({
    name: {
        type: String,
        required: true,
    },
    age: {
        type: Number,
        required: true,
        min: 1
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        required: true,
    }
})

const User = mongoose.model("User", userSchema);

// Signup Route Flow -> info recieve -> email check -> password hash -> create

app.post("/signup", async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // Email Check
        const exists = await User.findOne({ email })
        if (exists) res.status(400).send("Email Already registered yaar!")

        // Password Hash
        const hashed = await bcrypt.hash(password, 10);

        const user = await User.create({
            name,
            email,
            password: hashed,
        })

        res.json({ message: "Signup successful yaar!", user });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
})

// Login Route Flow - info receive -> user check -> password check -> token -> res send
app.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) res.status(400).send("user registered nahi hai yaar!");

        const match = await bcrypt.compare(password, user.password);
        if (!match) res.status(400).send("Wrong Password Yaar!")

        // token
        const token = jwt.sign(
            { userId: user._id },
            process.env.SECRET,
            { expiresIn: "7d" },
        )

        res.json({
            message: "Login sucessful yaar!",
            token
        })
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
})

// Middleware - Protect Route
function authMiddleware(req, res, next) {
    const header = req.headers.authorization;
    if (!header) res.status(401).send("Token missing yaar");

    const token = header.split(" ")[1] // "Bearer token"

    try {
        const decoded = jwt.verify(token, process.env.SECRET);
        req.userId = decoded.userId; // store for rest use
        next();
    } catch (err) {
        res.status(401).send("Invalid or expired token")
    }

}

// Protected Route
app.get("/profile", authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.userId).select("-password");
        res.json({ message: "protected route test successful", user });
    } catch (err) {
        res.status(500).json({ message: err.message })
    }
})

app.listen(5000, () => {
    console.log("Server running yaar")
})