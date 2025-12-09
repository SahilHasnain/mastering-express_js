const jwt = require("jsonwebtoken")
const apiError = require("../utils/apiError");

module.exports = (req, res, next) => {
    const header = req.headers.authorization;

    if (!header) throw new apiError(401, "Authorization header required")

    const token = header.split(" ")[1];

    try {
        const decoded = jwt.verify(token, process.env.ACCESS_SECRET);
        req.userId = decoded.userId;
        next();
    } catch (err) {
        throw new apiError(401, "Invalid or expired token")
    }
}