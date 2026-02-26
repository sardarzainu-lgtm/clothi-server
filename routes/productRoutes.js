const express = require('express');
const router = express.Router();
const asyncHandler = require('express-async-handler');
const { body, param, validationResult } = require('express-validator');
const Product = require('../models/Product.js');
const { protect, admin } = require('../middleware/authMiddleware.js');
const { auditLog } = require('../middleware/auditMiddleware.js');

// @desc    Fetch all products
// @route   GET /api/products
// @access  Public
router.get('/', asyncHandler(async (req, res) => {
    try {
        const products = await Product.find({});
        res.json(products);
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ message: 'Error fetching products', error: error.message });
    }
}));

// @desc    Fetch single product
// @route   GET /api/products/:id
// @access  Public
router.get('/:id', [
    param('id').isMongoId().withMessage('Invalid product ID'),
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400);
        throw new Error(errors.array()[0].msg);
    }

    const product = await Product.findById(req.params.id);
    if (product) {
        res.json(product);
    } else {
        res.status(404);
        throw new Error('Product not found');
    }
}));

// @desc    Delete a product
// @route   DELETE /api/products/:id
// @access  Private/Admin
router.delete('/:id', [
    param('id').isMongoId().withMessage('Invalid product ID'),
], protect, admin, auditLog('PRODUCT_DELETE', 'Product'), asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400);
        throw new Error(errors.array()[0].msg);
    }

    const product = await Product.findById(req.params.id);
    if (product) {
        await product.deleteOne();
        res.json({ message: 'Product removed' });
    } else {
        res.status(404);
        throw new Error('Product not found');
    }
}));

// @desc    Create a product
// @route   POST /api/products
// @access  Private/Admin
router.post('/', protect, admin, auditLog('PRODUCT_CREATE', 'Product'), asyncHandler(async (req, res) => {
    const product = new Product({
        name: 'Sample name',
        price: 0,
        user: req.user._id,
        image: '/images/sample.jpg',
        brand: 'Sample brand',
        category: 'Sample category',
        countInStock: 0,
        numReviews: 0,
        description: 'Sample description',
    });

    const createdProduct = await product.save();
    res.status(201).json(createdProduct);
}));

// @desc    Update a product
// @route   PUT /api/products/:id
// @access  Private/Admin
router.put('/:id', [
    param('id').isMongoId().withMessage('Invalid product ID'),
    body('name').optional().trim().isLength({ min: 1, max: 200 }).withMessage('Name must be between 1 and 200 characters'),
    body('price').optional().isFloat({ min: 0 }).withMessage('Price must be a positive number'),
    body('countInStock').optional().isInt({ min: 0 }).withMessage('Stock count must be a non-negative integer'),
    body('discountPercentage').optional().isFloat({ min: 0, max: 100 }).withMessage('Discount must be between 0 and 100'),
], protect, admin, auditLog('PRODUCT_UPDATE', 'Product'), asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400);
        throw new Error(errors.array()[0].msg);
    }

    const {
        name,
        price,
        originalPrice,
        discountPercentage,
        isOnSale,
        description,
        image,
        brand,
        category,
        countInStock,
    } = req.body;

    const product = await Product.findById(req.params.id);

    if (!product) {
        res.status(404);
        throw new Error('Product not found');
    }

    // Sanitize and update only provided fields
    if (name !== undefined) product.name = name.trim();
    if (price !== undefined) product.price = parseFloat(price);
    if (originalPrice !== undefined) product.originalPrice = originalPrice ? parseFloat(originalPrice) : null;
    if (discountPercentage !== undefined) product.discountPercentage = Math.max(0, Math.min(100, parseFloat(discountPercentage) || 0));
    if (isOnSale !== undefined) product.isOnSale = Boolean(isOnSale);
    if (description !== undefined) product.description = description.trim();
    if (image !== undefined) product.image = image.trim();
    if (brand !== undefined) product.brand = brand.trim();
    if (category !== undefined) product.category = category.trim();
    if (countInStock !== undefined) product.countInStock = Math.max(0, parseInt(countInStock));

    const updatedProduct = await product.save();
    res.json(updatedProduct);
}));

module.exports = router;
