const express = require('express');
const router = express.Router();
const asyncHandler = require('express-async-handler');
const { body, param, validationResult } = require('express-validator');
const Order = require('../models/Order.js');
const { protect, admin } = require('../middleware/authMiddleware.js');
const { auditLog } = require('../middleware/auditMiddleware.js');

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
router.post('/', [
    body('orderItems').isArray({ min: 1 }).withMessage('Order must have at least one item'),
    body('shippingAddress').isObject().withMessage('Shipping address is required'),
    body('paymentMethod').notEmpty().withMessage('Payment method is required'),
    body('itemsPrice').isFloat({ min: 0 }).withMessage('Items price must be a positive number'),
    body('totalPrice').isFloat({ min: 0 }).withMessage('Total price must be a positive number'),
], protect, asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400);
        throw new Error(errors.array()[0].msg);
    }

    const {
        orderItems,
        shippingAddress,
        paymentMethod,
        itemsPrice,
        taxPrice,
        shippingPrice,
        totalPrice,
    } = req.body;

    if (orderItems && orderItems.length === 0) {
        res.status(400);
        throw new Error('No order items');
    }

    const order = new Order({
        orderItems,
        user: req.user._id,
        shippingAddress,
        paymentMethod,
        itemsPrice,
        taxPrice,
        shippingPrice,
        totalPrice,
    });

    const createdOrder = await order.save();
    res.status(201).json(createdOrder);
}));

// @desc    Get logged in user orders
// @route   GET /api/orders/myorders
// @access  Private
router.get('/myorders', protect, asyncHandler(async (req, res) => {
    const orders = await Order.find({ user: req.user._id });
    res.json(orders);
}));

// @desc    Get order by ID
// @route   GET /api/orders/:id
// @access  Private
router.get('/:id', [
    param('id').isMongoId().withMessage('Invalid order ID'),
], protect, asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400);
        throw new Error(errors.array()[0].msg);
    }

    const order = await Order.findById(req.params.id).populate(
        'user',
        'name email'
    );

    if (!order) {
        res.status(404);
        throw new Error('Order not found');
    }

    // Security: Check if user owns the order OR is admin
    if (order.user._id.toString() !== req.user._id.toString() && !req.user.isAdmin) {
        res.status(403);
        throw new Error('Not authorized to access this order');
    }

    res.json(order);
}));

// @desc    Update order to paid
// @route   PUT /api/orders/:id/pay
// @access  Private
router.put('/:id/pay', [
    param('id').isMongoId().withMessage('Invalid order ID'),
    body('transactionId').optional().trim().isLength({ min: 1 }).withMessage('Transaction ID must not be empty'),
], protect, asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400);
        throw new Error(errors.array()[0].msg);
    }

    const order = await Order.findById(req.params.id);

    if (!order) {
        res.status(404);
        throw new Error('Order not found');
    }

    // Security: Check if user owns the order OR is admin
    if (order.user.toString() !== req.user._id.toString() && !req.user.isAdmin) {
        res.status(403);
        throw new Error('Not authorized to update this order');
    }

    // Prevent double payment
    if (order.isPaid) {
        res.status(400);
        throw new Error('Order is already paid');
    }

    order.isPaid = true;
    order.paidAt = Date.now();
    order.paymentResult = {
        id: req.body.id || null,
        status: req.body.status || 'completed',
        update_time: req.body.update_time || new Date().toISOString(),
        email_address: req.body.email_address || req.user.email,
        transactionId: req.body.transactionId ? req.body.transactionId.trim() : null, // Manual payment ID
    };

    const updatedOrder = await order.save();
    res.json(updatedOrder);
}));

// @desc    Get all orders
// @route   GET /api/orders
// @access  Private/Admin
router.get('/', protect, admin, asyncHandler(async (req, res) => {
    const orders = await Order.find({}).populate('user', 'id name');
    res.json(orders);
}));

module.exports = router;
