const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const nodemailer = require("nodemailer");
const crypto = require("crypto");

const app = express();
app.use(express.json());

// MongoDB connection
mongoose
    .connect(process.env.MONGO_URI)
    .then(() => console.log("MongoDB connected"))
    .catch((err) => console.log("DB error:", err));

// Schema

const userSchema = new mongoose.Schema({
    name: String,
    email: { type: String, required: true, unique: true },
    password: String,

    // reset-password-fields
    hashedToken: String,
    tokenExpires: Date,
})

const User = mongoose.model("User", userSchema);

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
})

async function sendEmail(to, subject, text) {
    await transporter.sendMail({
        from: `"Your app" <${process.env.EMAIL_USER}>`,
        to,
        subject,
        text
    })
}

// generate token function
function generateToken() {
    const token = crypto.randomBytes(32).toString("hex");

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    return { token, hashedToken }
}

// Routes

app.post("/forgot-password", async (req, res) => {
    const { email } = req.body;

    const generic = { message: "Reset password link will be sent to your email if account exists" }

    const user = await User.findOne({ email });

    if (!user) return res.json(generic);

    const { token, hashedToken } = generateToken();

    user.hashedToken = hashedToken;
    user.tokenExpires = Date.now() + 10 * 60 * 1000
    await user.save();

    const resetLink = `http://localhost:3000/reset-password?token=${token}&id=${user._id}`;

    await sendEmail(email, "Password reset link", `Click the link to reset your password: ${resetLink}`);

    res.json(generic);
});

app.post("/reset-password", async (req, res) => {
    const { userId, token, newPassword } = req.body;

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await user.findOne({
        _id: userId,
        hashedToken,
        tokenExpires: { $gt: Date.now() }
    })

    if (!user) return res.status(400).json({ message: "Invalid or expired token" });

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    user.password = hashedPassword;

    // clear token fields
    user.hashedToken = undefined;
    user.tokenExpires = undefined;

    await user.save()

    res.json({ message: "Password reset success" });
})