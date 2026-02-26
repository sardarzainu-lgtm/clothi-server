const express = require('express');
const router = express.Router();
const asyncHandler = require('express-async-handler');
const DailyDeal = require('../models/DailyDeal.js');
const { protect, admin } = require('../middleware/authMiddleware.js');
const { auditLog } = require('../middleware/auditMiddleware.js');

// @desc    Get active daily deals
// @route   GET /api/dailydeals
// @access  Public
router.get('/', asyncHandler(async (req, res) => {
    const deals = await DailyDeal.find({ isActive: true })
        .populate('product')
        .sort({ createdAt: -1 });
    res.json(deals);
}));

// @desc    Get single daily deal
// @route   GET /api/dailydeals/:id
// @access  Public
router.get('/:id', asyncHandler(async (req, res) => {
    const deal = await DailyDeal.findById(req.params.id).populate('product');
    if (deal) {
        res.json(deal);
    } else {
        res.status(404);
        throw new Error('Daily deal not found');
    }
}));

// @desc    Create daily deal
// @route   POST /api/dailydeals
// @access  Private/Admin
router.post('/', protect, admin, auditLog('DAILY_DEAL_CREATE', 'DailyDeal'), asyncHandler(async (req, res) => {
    const { product, endTime, discountPercentage } = req.body;

    // Validate required fields
    if (!product || !endTime) {
        res.status(400);
        throw new Error('Product and end time are required');
    }

    // Validate and parse discount percentage
    let discount = 0;
    if (discountPercentage !== undefined && discountPercentage !== null && discountPercentage !== '') {
        discount = parseFloat(discountPercentage);
        if (isNaN(discount) || discount < 0 || discount > 100) {
            res.status(400);
            throw new Error('Discount percentage must be a number between 0 and 100');
        }
    }

    // Check if product already has an active deal
    const existingDeal = await DailyDeal.findOne({ 
        product, 
        isActive: true 
    });

    if (existingDeal) {
        res.status(400);
        throw new Error('This product already has an active daily deal');
    }

    const deal = await DailyDeal.create({
        product,
        endTime: new Date(endTime),
        discountPercentage: discount,
        user: req.user._id,
        isActive: true,
    });

    const populatedDeal = await DailyDeal.findById(deal._id).populate('product');
    res.status(201).json(populatedDeal);
}));

// @desc    Update daily deal
// @route   PUT /api/dailydeals/:id
// @access  Private/Admin
router.put('/:id', protect, admin, auditLog('DAILY_DEAL_UPDATE', 'DailyDeal'), asyncHandler(async (req, res) => {
    const { product, endTime, discountPercentage, isActive } = req.body;

    const deal = await DailyDeal.findById(req.params.id);

    if (deal) {
        if (product) deal.product = product;
        if (endTime) deal.endTime = new Date(endTime);
        if (discountPercentage !== undefined) deal.discountPercentage = discountPercentage;
        if (isActive !== undefined) deal.isActive = isActive;

        const updatedDeal = await deal.save();
        const populatedDeal = await DailyDeal.findById(updatedDeal._id).populate('product');
        res.json(populatedDeal);
    } else {
        res.status(404);
        throw new Error('Daily deal not found');
    }
}));

// @desc    Delete daily deal
// @route   DELETE /api/dailydeals/:id
// @access  Private/Admin
router.delete('/:id', protect, admin, auditLog('DAILY_DEAL_DELETE', 'DailyDeal'), asyncHandler(async (req, res) => {
    const deal = await DailyDeal.findById(req.params.id);

    if (deal) {
        await deal.deleteOne();
        res.json({ message: 'Daily deal removed' });
    } else {
        res.status(404);
        throw new Error('Daily deal not found');
    }
}));

module.exports = router;

