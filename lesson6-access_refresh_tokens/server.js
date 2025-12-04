const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

mongoose.connect("mongodb://127.0.0.1:27017/refresh-auth");

// ---------------------------
// USER MODEL
// ---------------------------
const userSchema = new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    password: String,
    refreshToken: String   // refresh token store karne ke liye
});

const User = mongoose.model("User", userSchema);

// Token functions

function createAccessToken(userId) {
    return jwt.sign(
        { userId },
        "ACCESS_SECRET",
        { expiresIn: "10m" },
    )
}

function createRefreshToken(userId) {
    return jwt.sign(
        { userId },
        "REFRESH_SECRET",
        { expiresIn: "7d" },
    )
}

// Signup Route
app.post("/signup", async (req, res) => {
    const { name, email, password } = req.body;

    const hashed = await bcrypt.hash(password, 10);

    const user = User.create({
        name,
        email,
        password: hashed,
    })

    res.json({ message: "Signup successfull", user });
})

// Login Route
app.post("/login", async (req, res) => {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) res.status(400).send("User not found yaar!");

    const match = await bcrypt.compare(password, user.password);
    if (!match) res.status(400).send("Wrong Password");

    // Create tokens
    const accessToken = createAccessToken(user._id);
    const refreshToken = createRefreshToken(user._id);

    // Save refresh token in DB
    user.refreshToken = refreshToken;
    await user.save();

    res.json({
        message: "Login Successful",
        accessToken,
        refreshToken
    })
})

// Refresh Token
app.post("/refresh", async (req, res) => {
    const { token } = req.body;

    if (!token) res.status(400).send("Token missing yaar!");

    try {
        const decoded = await jwt.verify(token, "REFRESH_TOKEN");

        const user = User.findbyId(decoded.userId);

        if (!user || user.refreshToken !== token) res.status(401).send("Invalid refresh token");

        const newAccessToken = createAccessToken(user._id)

        res.json({
            accessToken: newAccessToken,
        })
    } catch (err) {
        res.status(401).send("Token expired yaar: " + err)
    }
})

// Logout Route
app.post("/logout", async (req, res) => {
    const { token } = req.body;

    const user = await User.findOne({ refreshToken: token });

    if (user) {
        user.refreshToken = null;
        await user.save();
    }

    res.send("Logout success")
})

// Server Listen
app.listen(5000, () => console.log("Server running on port 5000"));