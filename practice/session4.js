const express = require("express");
const { default: mongoose } = require("mongoose");

const app = express();
app.use(express.json());

const userSchema = new mongoose.Schema({
    name: String,
    email: String,
    password: String,
    role: {
        type: String,
        enum: ["user", "admin"],
        default: "user"
    }
})

function createAccessToken(userId, userRole) {
    return jwt.sign(
        { userId, userRole },
        "SECRET",
        { expiresIn: "7d" }
    )
}

function authMiddleware(req, res, next) {
    const header = req.headers.authorization;

    if (!header) res.status(400).send("Token missing yaar!");

    const token = header.split(" ")[1];

    try {
        const decoded = jwt.verify(token, "SECRET");

        req.userId = decoded.userId;
        req.userRole = decoded.userRole;
        next();
    } catch (err) {
        res.status(401).send("Invalid or expired token");
    }

}

function allowRoles(...roles) {

    return (req, res, next) => {
        if (!roles.includes(req.userRole)) {
            return res.status(403).send("Access denied");
        }

        next();
    }

}

app.get("/profile", authMiddleware, allowRoles("user", "admin", "students"), async (req, res) => {
    const user = await User.findById(req.userId).select("-password");
    res.json({ message: "Profile data", user });
})