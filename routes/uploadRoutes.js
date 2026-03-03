const path = require('path');
const express = require('express');
const multer = require('multer');
const asyncHandler = require('express-async-handler');
const fs = require('fs').promises;
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware.js');
const { auditLog } = require('../middleware/auditMiddleware.js');
const { generateImageSizes } = require('../utils/imageOptimizer.js');
const { isCloudinaryConfigured, uploadBufferToCloudinary } = require('../utils/cloudinaryUpload.js');

// Use memory storage when Cloudinary is configured (e.g. Hostinger) so uploads persist across redeploys
const memoryStorage = multer.memoryStorage();
const diskStorage = multer.diskStorage({
    destination(req, file, cb) {
        cb(null, 'uploads/');
    },
    filename(req, file, cb) {
        cb(
            null,
            `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`
        );
    },
});

const storage = isCloudinaryConfigured() ? memoryStorage : diskStorage;

function checkFileType(file, cb) {
    // Allow all common image formats including less common ones
    const allowedExtensions = /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico|tiff|tif|heic|heif|avif|jfif|pjpeg|pjp|apng|jxl|raw|cr2|nef|orf|sr2|dng|psd|ai|eps|pdf|tga|exr|hdr|dds|ktx|ktx2|basis|gltf|glb)$/i;
    
    // Comprehensive MIME types for images
    const allowedMimeTypes = /^image\/(jpeg|jpg|png|gif|webp|svg\+xml|svg|bmp|ico|tiff|tif|heic|heif|avif|jxl|vnd\.adobe\.photoshop|pdf|vnd\.ms-photo|x-icon|vnd\.djvu|vnd\.microsoft\.icon|x-ms-bmp|x-portable-bitmap|x-portable-graymap|x-portable-pixmap|x-rgb|x-xbitmap|x-xpixmap|x-xwindowdump)$/i;
    
    const extname = allowedExtensions.test(path.extname(file.originalname));
    const mimetype = allowedMimeTypes.test(file.mimetype);

    // Additional security: Check if file is actually an image by checking MIME type starts with 'image/'
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
        return cb('Invalid file type. Only image files are allowed.');
    }

    if (extname && mimetype) {
        return cb(null, true);
    } else {
        cb('Images only! Please upload a valid image file. Supported formats: jpg, jpeg, png, gif, webp, svg, bmp, ico, tiff, tif, heic, heif, avif, jxl, and more.');
    }
}

const upload = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: function (req, file, cb) {
        checkFileType(file, cb);
    },
});

router.post('/', protect, admin, upload.single('image'), auditLog('FILE_UPLOAD', 'File'), asyncHandler(async (req, res) => {
    if (!req.file) {
        res.status(400);
        throw new Error('No file uploaded');
    }
    
    // Additional security checks
    const fileExtension = path.extname(req.file.originalname).toLowerCase();
    const dangerousExtensions = ['.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js', '.jar', '.sh', '.php', '.asp', '.aspx', '.jsp'];
    
    if (dangerousExtensions.includes(fileExtension)) {
        if (req.file.path) await fs.unlink(req.file.path).catch(() => {});
        res.status(400);
        throw new Error('File type not allowed for security reasons');
    }
    
    // Cloudinary: upload buffer and return URLs (no local file; survives redeploys)
    if (isCloudinaryConfigured() && req.file.buffer) {
        try {
            const result = await uploadBufferToCloudinary(req.file.buffer, req.file.originalname);
            return res.json({
                imageUrl: result.imageUrl,
                images: result.images,
                thumbnail: result.thumbnail,
                medium: result.medium,
                large: result.large,
                original: result.original,
            });
        } catch (err) {
            console.error('Cloudinary upload error:', err);
            throw new Error('Image upload failed. Check Cloudinary configuration.');
        }
    }
    
    // Local disk: optimize and return /uploads/ paths
    try {
        const baseFilename = req.file.filename.replace(/\.[^/.]+$/, '');
        const optimizedImages = await generateImageSizes(req.file.path, baseFilename);
        res.json({ 
            imageUrl: optimizedImages.medium || optimizedImages.original,
            images: optimizedImages,
            thumbnail: optimizedImages.thumbnail,
            medium: optimizedImages.medium,
            large: optimizedImages.large,
            original: optimizedImages.original || optimizedImages.jpg
        });
    } catch (error) {
        console.error('Image optimization error:', error);
        const relativePath = `/uploads/${req.file.filename}`;
        res.json({ imageUrl: relativePath, images: { original: relativePath } });
    }
}));

module.exports = router;
