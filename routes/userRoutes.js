const express = require('express');
const router = express.Router();
const asyncHandler = require('express-async-handler');
const { body, validationResult } = require('express-validator');
const User = require('../models/User.js');
const BlacklistedToken = require('../models/BlacklistedToken.js');
const { generateToken } = require('../utils/generateToken.js');
const { protect } = require('../middleware/authMiddleware.js');

// @desc    Admin-only confidential login
// @route   POST /api/users/admin-login
// @access  Public (gated by secret key + admin role)
router.post('/admin-login', [
    body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
    body('password').notEmpty().withMessage('Password is required'),
    body('accessKey').notEmpty().withMessage('Access key is required'),
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400);
        throw new Error(errors.array()[0].msg);
    }

    const { email, password, accessKey } = req.body;

    if (!process.env.ADMIN_ACCESS_KEY || accessKey !== process.env.ADMIN_ACCESS_KEY) {
        res.status(401);
        throw new Error('Invalid admin credentials');
    }

    const user = await User.findOne({ email, isAdmin: true });

    if (user && (await user.matchPassword(password))) {
        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            isAdmin: user.isAdmin,
            token: generateToken(user._id),
        });
    } else {
        res.status(401);
        throw new Error('Invalid admin credentials');
    }
}));

// Customer auth is intentionally disabled for storefront guest commerce.
const customerAuthDisabled = (req, res) => {
    res.status(403).json({
        message: 'Customer authentication is disabled. Continue shopping as guest.',
    });
};

// @desc    Customer login (disabled)
// @route   POST /api/users/login
// @access  Public
router.post('/login', customerAuthDisabled);

// @desc    Customer google login (disabled)
// @route   POST /api/users/google-login
// @access  Public
router.post('/google-login', customerAuthDisabled);

// @desc    Customer registration (disabled)
// @route   POST /api/users
// @access  Public
router.post('/', customerAuthDisabled);

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
router.get('/profile', protect, asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);

    if (user) {
        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            isAdmin: user.isAdmin,
        });
    } else {
        res.status(404);
        throw new Error('User not found');
    }
}));

// @desc    Logout user (blacklist token)
// @route   POST /api/users/logout
// @access  Private
router.post('/logout', protect, asyncHandler(async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (token) {
        // Blacklist the token
        await BlacklistedToken.create({
            token,
            userId: req.user._id,
        });
    }
    
    res.json({ message: 'Logged out successfully' });
}));

module.exports = router;
