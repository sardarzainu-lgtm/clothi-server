const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const User = require('../models/User.js');
const BlacklistedToken = require('../models/BlacklistedToken.js');

const protect = asyncHandler(async (req, res, next) => {
    let token;

    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        try {
            token = req.headers.authorization.split(' ')[1];
            
            // Check if token is blacklisted
            const isBlacklisted = await BlacklistedToken.findOne({ token });
            if (isBlacklisted) {
                res.status(401);
                throw new Error('Token has been revoked');
            }
            
            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            // Check if token is a refresh token (should not be used for auth)
            if (decoded.type === 'refresh') {
                res.status(401);
                throw new Error('Invalid token type');
            }
            
            // Get user from database
            req.user = await User.findById(decoded.id).select('-password');
            
            if (!req.user) {
                res.status(401);
                throw new Error('User not found');
            }
            
            next();
        } catch (error) {
            // Handle specific JWT errors
            if (error.name === 'JsonWebTokenError') {
                res.status(401);
                throw new Error('Invalid token');
            } else if (error.name === 'TokenExpiredError') {
                res.status(401);
                throw new Error('Token expired');
            } else {
                console.error('Auth error:', error.message);
                res.status(401);
                throw new Error('Not authorized, token failed');
            }
        }
    }

    if (!token) {
        res.status(401);
        throw new Error('Not authorized, no token');
    }
});

const admin = asyncHandler(async (req, res, next) => {
    if (req.user && req.user.isAdmin) {
        next();
    } else {
        res.status(401);
        throw new Error('Not authorized as an admin');
    }
});

module.exports = { protect, admin };
