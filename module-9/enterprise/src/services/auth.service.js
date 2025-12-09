const asyncHandler = require("../utils/asyncHandler")
const User = require("../models/User")
const apiResponse = require("../utils/apiResponse")
const apiError = require("../utils/apiError")
const { hashPassword, comparePassword } = require("../utils/password")
const { generateAccessToken, generateRefreshToken } = require("../utils/jwt")





exports.registerUser = asyncHandler(async (name, email, password) => {
    const exists = await User.findOne({ email })

    if(exists) throw new apiError(409, "user already registered");

    const hashed = hashPassword(password);

    const user = await User.create({
        name,
        email,
        password: hashed,
    })

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    user.refreshToken = refreshToken;

    await user.save();

    return { user, accessToken, refreshToken }
})

exports.loginUser = async (email, password) => {
    const user = await User.findOne({ email }).select("+password");
    if(!user) throw new apiError(404, "Invalid Credentials");

    const match = comparePassword(password, user.password);

    if(!match) throw new apiError(400, "Invalid Credentials");

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    user.refreshToken = refreshToken;
    await user.save();

    return { user, accessToken, refreshToken }
}

exports.getProfile = async (userId) => {
    const user = await User.findbyId(userId).select("password -refreshToken");
    
    if(!user) throw new apiError(404, "user not found");

    return user;
}
    