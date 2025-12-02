const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { default: mongoose } = require("mongoose");

const app = express();
app.use(express.json());

// MongoDB connection




const userSchema = new mongoose.Schema({
    name: String,
    email: String,
    password: String,
    role: {
        type: String,
        enum: ["user", "admin"],
        default: "user"
    },
    refreshToken: String
})

// Token functions
function createAccessToken(userId, userRole) {
    return jwt.sign(
        { userId, userRole },
        "ACCESS_SECRET",
        { expiresIn: "15m" }
    )
}

function refreshToken(userId, userRole) {
    return jwt.sign(
        { userId, userRole },
        "REFRESH_SECRET",
        { expiresIn: "7d" }
    )
}

// Role check middleware
function allowRoles(...roles) {

    return (req, res, next) => {
        if (!roles.includes(req.userRole)) {
            return res.status(403).send("Access denied yaar!");
        }
        next();
    };
}

// AuthMiddleware Flow -> 
function authMiddleware(req, res, next) {
    const header = req.headers.authorization
    if (!header) res.status(400).send("Token missing yaar")

    const token = header.split(" ")[1];

    try {
        const decoded = jwt.verify(token, "ACCESS_SECRET");

        req.userId = decoded.userId;
        req.userRole = decoded.userRole;
        next();
    } catch (err) {
        res.status(401).send("Token expired");
    }
}

// Protected Routes

app.get("/admin-stats", authMiddleware, allowRoles("admin"), (req, res) => {
    res.send("Admin only data yaar!")
})

app.get("/profile", authMiddleware, allowRoles("admin", "user"), (req, res) => {
    res.send("Profile Route - admin and user access")
})