const express = require('express');
const router = express.Router();
const asyncHandler = require('express-async-handler');
const Settings = require('../models/Settings.js');
const { protect, admin } = require('../middleware/authMiddleware.js');
const { auditLog } = require('../middleware/auditMiddleware.js');

// @desc    Get settings
// @route   GET /api/settings
// @access  Public
router.get('/', asyncHandler(async (req, res) => {
    try {
        const settings = await Settings.getSettings();
        res.json(settings);
    } catch (error) {
        console.error('Error fetching settings:', error);
        // Return default settings if error
        res.json({ 
            heroImage: '',
            heroHeading: 'RAMZAN SALE',
            heroDescription: 'Get up to **30% off** on new arrivals. Discover premium fashion that defines your style.',
            topBannerText: 'WINTER SALE: UP TO 30%-50% OFF',
            topBannerEnabled: true
        });
    }
}));

// @desc    Update settings
// @route   PUT /api/settings
// @access  Private/Admin
router.put('/', protect, admin, auditLog('SETTINGS_UPDATE', 'Settings'), asyncHandler(async (req, res) => {
    const { heroImage, heroHeading, heroDescription, topBannerText, topBannerEnabled } = req.body;

    let settings = await Settings.findOne();
    
    if (!settings) {
        settings = await Settings.create({ heroImage, heroHeading, heroDescription, topBannerText, topBannerEnabled });
    } else {
        if (heroImage !== undefined) {
            settings.heroImage = heroImage;
        }
        if (heroHeading !== undefined) {
            settings.heroHeading = heroHeading;
        }
        if (heroDescription !== undefined) {
            settings.heroDescription = heroDescription;
        }
        if (topBannerText !== undefined) {
            settings.topBannerText = topBannerText;
        }
        if (topBannerEnabled !== undefined) {
            settings.topBannerEnabled = topBannerEnabled;
        }
        await settings.save();
    }

    res.json(settings);
}));

module.exports = router;

