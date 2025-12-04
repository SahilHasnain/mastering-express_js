const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto"); // for secure random token
const nodemailer = require("nodemailer");
const rateLimit = require("express-rate-limit")

const app = express();
app.use(express.json());

mongoose.connect("mongodb://127.0.0.1:27017/pass-reset-demo")
    .then(() => console.log("Mongo connected"))
    .catch(err => console.log("DB error", err.message));

// User Schema (with reset fields)

const userSchema = new mongoose.Schema({
    name: String,
    email: {
        type: String,
        unique: true
    },
    password: String,
    // otp fields
    hashedOtp: String,
    otpExpires: Date,
    otpVerified: Boolean,
})

const user = mongoose.model("User", userSchema)

const forgotLimiter = rateLimit({
    windowMS: 10 * 60 * 1000,
    max: 5,
    message: "Too many requests. Please try again later"
})

function generateOTP() {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    const hashed = crypto.createHash("sha256").update(otp).digest("hex");

    return { otp, hashed }
}

// Nodemailer transporter
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    }
})

// Email send function
async function sendEmail(to, subject, text) {
    await transporter.sendMail({
        from: `"Your App" <${process.env.EMAIL_USER}>`,
        to,
        subject,
        text
    })
}

app.post("/forgot-password-otp", forgotLimiter, async (req, res) => {
    const { email } = req.body;

    const user = await User.findOne({ email });

    const genericResponse = { message: "Otp will be sent if account exist" };

    if (!user) return res.json(genericResponse);

    const { otp, hashed } = generateOTP();

    user.hashedOtp = hashed;
    user.otpExpires = Date.now() + 10 * 60 * 1000;
    user.otpVerified = false;

    await user.save();

    // Send otp to user email
    await sendEmail(email, "Your OTP Code", `your otp is:${otp}`);

    res.json(genericResponse);
})

app.post("/verify-otp", forgotLimiter, async (req, res) => {
    const { email, otp } = req.body;

    const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

    const user = await User.findOne({
        email,
        hashedOtp,
        otpExpires: { $gt: Date.now() }
    })

    if (!user) return res.send("Invalid or expired otp");

    user.otpVerified = true;
    await user.save();

    res.send("Otp verified successfully");
})

app.post("/reset-password-with-otp", forgotLimiter, async (req, res) => {
    const { email, password } = req.body;

    const user = await user.findOne({
        email,
        otpVerified: true,
    })

    if (!user) res.status(400).json({ message: "otp not verified, please verify first" })

    const hashedPassword = await bcrypt.hash(password, 10);

    user.password = hashedPassword;

    // Clear otp fields
    user.hashedOtp = undefined;
    user.otpExpires = undefined;
    user.otpVerified = false;
    await user.save();

    res.json({ message: "password reset success" });
})