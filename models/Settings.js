const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
    heroImage: {
        type: String,
        default: '/uploads/default-hero.jpg', // Default hero image path
    },
    heroHeading: {
        type: String,
        default: 'RAMZAN SALE',
    },
    heroDescription: {
        type: String,
        default: 'Get up to **30% off** on new arrivals. Discover premium fashion that defines your style.',
    },
    topBannerText: {
        type: String,
        default: 'WINTER SALE: UP TO 30%-50% OFF',
    },
    topBannerEnabled: {
        type: Boolean,
        default: true,
    },
}, {
    timestamps: true,
});

// Ensure only one settings document exists
settingsSchema.statics.getSettings = async function() {
    let settings = await this.findOne();
    if (!settings) {
        settings = await this.create({});
    }
    return settings;
};

const Settings = mongoose.model('Settings', settingsSchema);
module.exports = Settings;

