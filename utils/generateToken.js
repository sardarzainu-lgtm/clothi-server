const jwt = require('jsonwebtoken');

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '7d', // Reduced from 30d to 7d for better security
    });
};

// Generate refresh token for longer sessions
const generateRefreshToken = (id) => {
    return jwt.sign({ id, type: 'refresh' }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
};

module.exports = { generateToken, generateRefreshToken };
