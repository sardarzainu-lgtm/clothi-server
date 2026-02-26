const express = require('express');
const router = express.Router();
const asyncHandler = require('express-async-handler');
const Review = require('../models/Review.js');
const Product = require('../models/Product.js');
const { protect } = require('../middleware/authMiddleware.js');

// @desc    Create a new review for a product
// @route   POST /api/products/:id/reviews
// @access  Private
router.post('/:id/reviews', protect, asyncHandler(async (req, res) => {
    const { rating, comment } = req.body;
    const productId = req.params.id;

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
        res.status(404);
        throw new Error('Product not found');
    }

    // Check if user already reviewed this product
    const existingReview = await Review.findOne({
        user: req.user._id,
        product: productId,
    });

    if (existingReview) {
        res.status(400);
        throw new Error('You have already reviewed this product');
    }

    // Create review
    const review = await Review.create({
        user: req.user._id,
        product: productId,
        rating,
        comment,
    });

    res.status(201).json(review);
}));

// @desc    Get all reviews for a product
// @route   GET /api/products/:id/reviews
// @access  Public
router.get('/:id/reviews', asyncHandler(async (req, res) => {
    const reviews = await Review.find({ product: req.params.id })
        .populate('user', 'name')
        .sort({ createdAt: -1 });

    res.json(reviews);
}));

// @desc    Get average rating and count for a product
// @route   GET /api/products/:id/rating
// @access  Public
router.get('/:id/rating', asyncHandler(async (req, res) => {
    const reviews = await Review.find({ product: req.params.id });

    if (reviews.length === 0) {
        return res.json({ averageRating: 0, reviewCount: 0 });
    }

    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = totalRating / reviews.length;

    res.json({
        averageRating: Math.round(averageRating * 10) / 10, // Round to 1 decimal
        reviewCount: reviews.length,
    });
}));

module.exports = router;
