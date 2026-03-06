const express = require('express');
const router = express.Router();
const asyncHandler = require('express-async-handler');
const { body, param, validationResult } = require('express-validator');
const Order = require('../models/Order.js');
const { protect, admin } = require('../middleware/authMiddleware.js');

const createOrderValidators = [
    body('orderItems').isArray({ min: 1 }).withMessage('Order must have at least one item'),
    body('shippingAddress').isObject().withMessage('Shipping address is required'),
    body('shippingAddress.firstName').notEmpty().withMessage('First name is required'),
    body('shippingAddress.lastName').notEmpty().withMessage('Last name is required'),
    body('shippingAddress.address').notEmpty().withMessage('Address is required'),
    body('shippingAddress.city').notEmpty().withMessage('City is required'),
    body('shippingAddress.postalCode').notEmpty().withMessage('Postal code is required'),
    body('shippingAddress.phoneNumber').notEmpty().withMessage('Phone number is required'),
    body('shippingAddress.customerEmail').optional().isEmail().withMessage('Valid customer email is required'),
    body('paymentMethod').notEmpty().withMessage('Payment method is required'),
    body('itemsPrice').isFloat({ min: 0 }).withMessage('Items price must be a positive number'),
    body('totalPrice').isFloat({ min: 0 }).withMessage('Total price must be a positive number'),
];

const createOrder = async (req, res, userId = null, fallbackEmail = '') => {
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
        shippingPrice,
        totalPrice,
    } = req.body;

    if (orderItems && orderItems.length === 0) {
        res.status(400);
        throw new Error('No order items');
    }

    if (paymentMethod !== 'COD') {
        res.status(400);
        throw new Error('Only Cash on Delivery is supported');
    }

    const customerEmail = shippingAddress?.customerEmail || fallbackEmail;
    if (!customerEmail) {
        res.status(400);
        throw new Error('Customer email is required');
    }

    const order = new Order({
        orderItems,
        ...(userId ? { user: userId } : {}),
        shippingAddress: {
            ...shippingAddress,
            customerEmail,
        },
        paymentMethod: 'COD',
        itemsPrice,
        taxPrice: 0,
        shippingPrice,
        totalPrice,
    });

    const createdOrder = await order.save();
    res.status(201).json(createdOrder);
};

// @desc    Create new order (guest checkout)
// @route   POST /api/orders/guest
// @access  Public
router.post('/guest', createOrderValidators, asyncHandler(async (req, res) => {
    await createOrder(req, res);
}));

// @desc    Create new order (authenticated)
// @route   POST /api/orders
// @access  Private
router.post('/', createOrderValidators, protect, asyncHandler(async (req, res) => {
    await createOrder(req, res, req.user._id, req.user.email);
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

    // Security: Non-admin users can only access their own linked orders.
    if (!req.user.isAdmin) {
        if (!order.user || order.user._id.toString() !== req.user._id.toString()) {
            res.status(403);
            throw new Error('Not authorized to access this order');
        }
    }

    res.json(order);
}));

// @desc    Update order to paid
// @route   PUT /api/orders/:id/pay
// @access  Private/Admin
router.put('/:id/pay', [
    param('id').isMongoId().withMessage('Invalid order ID'),
    body('transactionId').optional().trim().isLength({ min: 1 }).withMessage('Transaction ID must not be empty'),
], protect, admin, asyncHandler(async (req, res) => {
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
