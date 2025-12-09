const jwt = require("jsonwebtoken");

exports.generateAccessToken = (userId) => {
    return jwt.sign(
        { userId },
        process.env.ACCESS_SECRET,
        { expiresIn: "10m" },
    )
}

exports.generateRefreshToken = (userId) => {
    return jwt.sign(
        { userId },
        process.env.REFRESH_SECRET,
        { expiresIn: "7d" }
    )
}