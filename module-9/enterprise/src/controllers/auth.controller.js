const apiResponse = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");

const AuthService = require("../services/auth.service");



exports.register = asyncHandler(async (req, res) => {
    const { name, email, password } = req.body;

    const result = await AuthService.registerUser(name, email, password);

    res.status(201).json(new apiResponse(201, "User registered", result))
})

exports.login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const result = await AuthService.loginUser(email, password);
    
    res.status(200).json(new apiResponse(200, "Login successful", result));
})

exports.profile = asyncHandler(async (req, res) => {
    const userId = req.userId;
    const user = await AuthService.getProfile(userId);

    return res.status(200).json(new apiResponse(200, "Success", user ))
})