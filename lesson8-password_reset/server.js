const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto"); // for secure random token
// const nodemailer = require("nodemailer"); // uncomment for real email

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
    // reset fields
    resetPasswordToken: String,
    resetPasswordExpires: Date,
})

const user = mongoose.model("User", userSchema)

// Helper: generatePlainToken + hashed version
function createResetToken() {
    const buffer = crypto.randomBytes(32)
    const plainToken = buffer.toString("hex");

    const hashed = crypto.createHash("sha256").update(plainToken).digest("hex");

    return { plainToken, hashed }
}

// ---------------------------
// (Optional) Email sender stub
// In production use nodemailer / SendGrid / SES
// ---------------------------
// async function sendResetEmail(toEmail, resetLink) {
//   // Example: nodemailer transporter
//   /*
//   const transporter = nodemailer.createTransport({
//     host: "smtp.example.com",
//     port: 587,
//     auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
//   });
//   await transporter.sendMail({
//     from: '"Your App" <no-reply@yourapp.com>',
//     to: toEmail,
//     subject: "Password reset",
//     text: `Reset link: ${resetLink}`
//   });
//   */
//   console.log("DEV: send reset link to", toEmail);
//   console.log("DEV: reset link ->", resetLink);
// }

// Forgot password route
app.post("/forgot-password", async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) res.status(400).send("Email required yaar!");

        const user = await User.findOne({ email });

        const genericResponse = { message: "If an account exists, you will receive the reset instructions in your email" }

        if (!user) return res.json(genericResponse);

        const { plainToken, hashed } = createResetToken();

        user.resetPasswordToken = hashed;
        user.resetPasswordExpires = Date.now() + 60 * 60 * 1000

        await user.save();

        const resetLink = `http://localhost:3000/reset-password?token=${plainToken}&id=${user._id}`;

        // Send email
        // await sendResetEmail(email, resetLink);

        return res.json(genericResponse);
    } catch (err) {
        res.status(500).json({ message: "Server Error", err });
    }
})

app.post("/reset-password", async (req, res) => {
    try {
        const { userId, token, password } = req.body;
        if (!userId || !token || !password) res.status(400).send("Missing required fields")

        const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

        // Find user with matching token and unexpired
        const user = await User.findOne({
            _id: userId,
            resetPasswordToken: hashedToken,
            resetPasswordExpires: { $gt: Date.now() }
        })

        if (!user) return res.status(401).json({ message: "invalid or expired token" });

        const hashedPassword = await bcrypt.hash(password, 10);
        user.password = hashedPassword;

        // clear reset fields (one-time use)
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;

        await user.save();

        return res.json({ message: "Password reset successful" });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Server Error", err })
    }
})

// Quick signup/login routes to test flow
// ---------------------------
app.post("/signup", async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!email || !password) return res.status(400).json({ message: "Email+password required" });

        const exists = await User.findOne({ email });
        if (exists) return res.status(400).json({ message: "Email taken" });

        const hashed = await bcrypt.hash(password, 10);
        const user = await User.create({ name, email, password: hashed });
        res.json({ message: "OK", userId: user._id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

app.listen(5000, () => console.log("Server running on 5000"));