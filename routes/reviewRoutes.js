const express = require('express');
const router = express.Router();
const asyncHandler = require('express-async-handler');
const { body, param, validationResult } = require('express-validator');
const Review = require('../models/Review.js');
const Product = require('../models/Product.js');
const { protect, admin } = require('../middleware/authMiddleware.js');

const validateRequest = (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400);
        throw new Error(errors.array()[0].msg);
    }
};

// @desc    Get all pending reviews for moderation
// @route   GET /api/products/admin/reviews/pending
// @access  Private/Admin
router.get('/admin/reviews/pending', protect, admin, asyncHandler(async (req, res) => {
    const pendingReviews = await Review.find({ status: 'pending' })
        .populate('product', 'name image')
        .populate('user', 'name email')
        .sort({ createdAt: -1 });

    res.json(pendingReviews);
}));

// @desc    Approve a review
// @route   PUT /api/products/admin/reviews/:reviewId/approve
// @access  Private/Admin
router.put('/admin/reviews/:reviewId/approve', [
    param('reviewId').isMongoId().withMessage('Invalid review ID'),
], protect, admin, asyncHandler(async (req, res) => {
    validateRequest(req, res);

    const review = await Review.findById(req.params.reviewId);
    if (!review) {
        res.status(404);
        throw new Error('Review not found');
    }

    review.status = 'approved';
    review.moderatedBy = req.user._id;
    review.moderatedAt = new Date();
    await review.save();

    res.json({ message: 'Review approved', review });
}));

// @desc    Reject a review
// @route   PUT /api/products/admin/reviews/:reviewId/reject
// @access  Private/Admin
router.put('/admin/reviews/:reviewId/reject', [
    param('reviewId').isMongoId().withMessage('Invalid review ID'),
], protect, admin, asyncHandler(async (req, res) => {
    validateRequest(req, res);

    const review = await Review.findById(req.params.reviewId);
    if (!review) {
        res.status(404);
        throw new Error('Review not found');
    }

    review.status = 'rejected';
    review.moderatedBy = req.user._id;
    review.moderatedAt = new Date();
    await review.save();

    res.json({ message: 'Review rejected', review });
}));

// @desc    Create a new guest review for a product
// @route   POST /api/products/:id/reviews
// @access  Public
router.post('/:id/reviews', [
    param('id').isMongoId().withMessage('Invalid product ID'),
    body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
    body('comment').trim().isLength({ min: 3, max: 1500 }).withMessage('Comment must be between 3 and 1500 characters'),
    body('guestName').trim().isLength({ min: 2, max: 80 }).withMessage('Name must be between 2 and 80 characters'),
    body('guestEmail').isEmail().withMessage('Valid email is required'),
], asyncHandler(async (req, res) => {
    validateRequest(req, res);

    const { rating, comment, guestName, guestEmail } = req.body;
    const productId = req.params.id;
    const normalizedEmail = guestEmail.trim().toLowerCase();

    const product = await Product.findById(productId);
    if (!product) {
        res.status(404);
        throw new Error('Product not found');
    }

    const existingReview = await Review.findOne({
        product: productId,
        guestEmail: normalizedEmail,
        status: { $in: ['pending', 'approved'] },
    });

    if (existingReview) {
        res.status(400);
        throw new Error('You have already submitted a review for this product');
    }

    const review = await Review.create({
        product: productId,
        rating,
        comment: comment.trim(),
        guestName: guestName.trim(),
        guestEmail: normalizedEmail,
        status: 'pending',
    });

    res.status(201).json({
        message: 'Review submitted and pending admin approval',
        reviewId: review._id,
    });
}));

// @desc    Get all reviews for a product
// @route   GET /api/products/:id/reviews
// @access  Public
router.get('/:id/reviews', [
    param('id').isMongoId().withMessage('Invalid product ID'),
], asyncHandler(async (req, res) => {
    validateRequest(req, res);

    const reviews = await Review.find({ product: req.params.id, status: 'approved' })
        .populate('user', 'name')
        .sort({ createdAt: -1 });

    const formattedReviews = reviews.map((review) => ({
        ...review.toObject(),
        displayName: review.user?.name || review.guestName || 'Guest',
    }));

    res.json(formattedReviews);
}));

// @desc    Get average rating and count for a product
// @route   GET /api/products/:id/rating
// @access  Public
router.get('/:id/rating', [
    param('id').isMongoId().withMessage('Invalid product ID'),
], asyncHandler(async (req, res) => {
    validateRequest(req, res);

    const reviews = await Review.find({ product: req.params.id, status: 'approved' });

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
