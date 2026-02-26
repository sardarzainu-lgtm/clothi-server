const mongoose = require('mongoose');

const blacklistedTokenSchema = new mongoose.Schema({
    token: {
        type: String,
        required: true,
        unique: true,
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    blacklistedAt: {
        type: Date,
        default: Date.now,
    },
}, {
    timestamps: true,
});

// Index for faster lookups (token is already unique, so no need for separate index)
// TTL index for automatic expiration after 7 days (604800 seconds)
blacklistedTokenSchema.index({ blacklistedAt: 1 }, { expireAfterSeconds: 604800 });

const BlacklistedToken = mongoose.model('BlacklistedToken', blacklistedTokenSchema);
module.exports = BlacklistedToken;

