const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');

dotenv.config();

// Security: Validate required environment variables
if (!process.env.JWT_SECRET) {
    console.error('ERROR: JWT_SECRET is not set in environment variables');
    process.exit(1);
}

if (!process.env.MONGO_URI) {
    console.warn('WARNING: MONGO_URI is not set, using default localhost connection');
}

const app = express();

// Security Middleware - Must be first
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:", "http://localhost:5000", "http://localhost:5173"],
        },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow images to be loaded cross-origin
}));

// Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

// Stricter rate limiting for authentication endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 requests per windowMs
    message: 'Too many authentication attempts, please try again after 15 minutes.',
    skipSuccessfulRequests: true,
});

app.use('/api/', limiter);
app.use('/api/users/login', authLimiter);
app.use('/api/users', authLimiter); // Registration endpoint

// Data Sanitization - Prevent NoSQL Injection
app.use(mongoSanitize());

// XSS Protection - Using express-validator for sanitization instead of deprecated xss-clean
// Input sanitization is handled in route validators

// Prevent HTTP Parameter Pollution
app.use(hpp());

// Body Parser with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS Configuration
app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
    optionsSuccessStatus: 200,
    // Allow image requests
    exposedHeaders: ['Content-Type', 'Content-Length'],
}));

// Database Connection
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/ecommerce')
    .then(() => console.log('MongoDB Connected'))
    .catch(err => {
        console.error('MongoDB Connection Error:', err);
        console.error('Please make sure MongoDB is running and accessible');
    });

const userRoutes = require('./routes/userRoutes.js');
const productRoutes = require('./routes/productRoutes.js');
const orderRoutes = require('./routes/orderRoutes.js');
const uploadRoutes = require('./routes/uploadRoutes.js');
const reviewRoutes = require('./routes/reviewRoutes.js');
const settingsRoutes = require('./routes/settingsRoutes.js');
const dailyDealRoutes = require('./routes/dailyDealRoutes.js');

// Routes
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/products', reviewRoutes); // Review routes nested under products
app.use('/api/settings', settingsRoutes);
app.use('/api/dailydeals', dailyDealRoutes);

const __dirname1 = path.resolve();
// Serve static files from uploads directory with CORS headers
app.use('/uploads', (req, res, next) => {
    // Set CORS headers for image requests
    res.header('Access-Control-Allow-Origin', process.env.CLIENT_URL || 'http://localhost:5173');
    res.header('Access-Control-Allow-Methods', 'GET');
    res.header('Access-Control-Allow-Credentials', 'true');
    next();
}, express.static(path.join(__dirname1, 'uploads'), {
    setHeaders: (res, path) => {
        // Cache images for 1 year
        res.set('Cache-Control', 'public, max-age=31536000');
    }
}));

app.get('/', (req, res) => {
    res.send('API is running...');
});

// Error handling middleware (must be after all routes)
app.use((err, req, res, next) => {
    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    res.status(statusCode);
    
    // Security: Don't leak sensitive information in production
    const isDevelopment = process.env.NODE_ENV !== 'production';
    
    res.json({
        message: err.message || 'An error occurred',
        ...(isDevelopment && { 
            stack: err.stack,
            error: err 
        }),
    });
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
