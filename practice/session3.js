const express = require("express");

const app = express();
app.use(express.json());

function authMiddleware(req, res, next) {
    const header = req.headers.authorization;

    if (!header) res.status(400).send("Token missing yaar!");

    const token = header.split(" ")[1];

    try {
        const decoded = jwt.verify(token, "SECRET");

        req.userId = decoded.userId;

        next();
    } catch (err) {
        res.status(401).send("Invalid or expired token");
    }

}

app.get("/profile", authMiddleware, async (req, res) => {
    const user = await User.findById(req.userId).select("-password");
    res.json({ message: "Profile data", user });
})