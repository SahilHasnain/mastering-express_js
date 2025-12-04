const express = require("express");
const jwt = require("jsonwebtoken")

const app = express();

app.use(express.json());

function generateAccessToken(userId) {
    return jwt.sign(
        { userId },
        "ACCESS_SECRET",
        { expiresIn: "10m" }
    )
}

function generateRefreshToken(userId) {
    return jwt.sign(
        { userId },
        "REFRESH_SECRET",
        { expiresIn: "7d" },
    )
}

app.post("/login", async (req, res) => {
    const { email, password } = req.body;

    if (!email) return res.send("Email required yaar!");

    const user = await User.findOne({ email });

    if (!user) res.status(404).send("User not found yaar!");

    const match = await bcrypt.compare(password, user.password);

    if (!match) res.status(400).send("Wrong password");

    const { accessToken } = generateAccessToken(user._id);
    const { refreshToken } = generateRefreshToken(user._id);

    user.refreshToken = refreshToken;

    res.json({
        message: "Login success",
        accessToken,
        refreshToken
    })
})

app.post("/refresh", async (req, res) => {
    const { token } = req.body;

    try {
        const decoded = jwt.verify(token, "REFRESH_SECRET");

        const user = await user.findOne({
            _id: decoded.userId,
            refreshToken: token,
        })

        if (!user) res.status(401).send("Invalid Token")

        const newAccessToken = generateAccessToken(user._id);

        res.json({ accessToken: newAccessToken })
    } catch (err) {
        res.status(401).json({ message: "Token expired" })
    }
})

app.post("/logout", async (req, res) => {
    const { token } = req.body;

    const user = await user.findOne({ refreshToken: token });

    if (!user) return res.status(401).json({ message: "Invalid Token" })

    user.refreshToken = null;
    await user.save();

    return res.json({ message: "Logout Success" });
})