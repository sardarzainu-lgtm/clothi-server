const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');

/**
 * Image Optimization Utility
 * Compresses, resizes, and converts images to WebP format for better performance
 */

// Image size configurations
const IMAGE_SIZES = {
    thumbnail: { width: 300, height: 300, quality: 80 },
    medium: { width: 800, height: 800, quality: 85 },
    large: { width: 1200, height: 1200, quality: 90 },
    original: { quality: 92 } // Keep original size but compress
};

/**
 * Optimize and resize image
 * @param {string} inputPath - Path to original image
 * @param {string} outputPath - Path to save optimized image
 * @param {Object} options - { width, height, quality }
 * @returns {Promise<string>} - Path to optimized image
 */
async function optimizeImage(inputPath, outputPath, options = {}) {
    const { width, height, quality = 85 } = options;
    
    let sharpInstance = sharp(inputPath);
    
    // Get image metadata
    const metadata = await sharpInstance.metadata();
    
    // Resize if dimensions provided
    if (width || height) {
        sharpInstance = sharpInstance.resize(width, height, {
            fit: 'inside', // Maintain aspect ratio, fit within dimensions
            withoutEnlargement: true, // Don't upscale smaller images
        });
    }
    
    // Convert to WebP format with optimization
    await sharpInstance
        .webp({ 
            quality: quality,
            effort: 6, // Higher effort = better compression (0-6)
        })
        .toFile(outputPath);
    
    return outputPath;
}

/**
 * Generate multiple sizes of an image
 * @param {string} filePath - Path to original uploaded file
 * @param {string} baseFilename - Base filename without extension
 * @returns {Promise<Object>} - Object with paths to different image sizes
 */
async function generateImageSizes(filePath, baseFilename) {
    const uploadsDir = path.dirname(filePath);
    const results = {};
    
    try {
        // Generate thumbnail (for product listings)
        const thumbnailPath = path.join(uploadsDir, `${baseFilename}-thumb.webp`);
        await optimizeImage(filePath, thumbnailPath, IMAGE_SIZES.thumbnail);
        results.thumbnail = `/uploads/${path.basename(thumbnailPath)}`;
        
        // Generate medium size (for product details)
        const mediumPath = path.join(uploadsDir, `${baseFilename}-medium.webp`);
        await optimizeImage(filePath, mediumPath, IMAGE_SIZES.medium);
        results.medium = `/uploads/${path.basename(mediumPath)}`;
        
        // Generate large size (for zoom/lightbox)
        const largePath = path.join(uploadsDir, `${baseFilename}-large.webp`);
        await optimizeImage(filePath, largePath, IMAGE_SIZES.large);
        results.large = `/uploads/${path.basename(largePath)}`;
        
        // Optimize original (keep for fallback, but compress)
        const originalOptimizedPath = path.join(uploadsDir, `${baseFilename}-original.webp`);
        await optimizeImage(filePath, originalOptimizedPath, IMAGE_SIZES.original);
        results.original = `/uploads/${path.basename(originalOptimizedPath)}`;
        
        // Also keep a compressed JPEG version for compatibility
        const jpegPath = path.join(uploadsDir, `${baseFilename}.jpg`);
        await sharp(filePath)
            .resize(1200, 1200, {
                fit: 'inside',
                withoutEnlargement: true,
            })
            .jpeg({ 
                quality: 85,
                mozjpeg: true, // Better compression
            })
            .toFile(jpegPath);
        results.jpg = `/uploads/${path.basename(jpegPath)}`;
        
        return results;
    } catch (error) {
        console.error('Error generating image sizes:', error);
        // Return original path as fallback
        return {
            original: `/uploads/${path.basename(filePath)}`,
            thumbnail: `/uploads/${path.basename(filePath)}`,
            medium: `/uploads/${path.basename(filePath)}`,
            large: `/uploads/${path.basename(filePath)}`,
        };
    }
}

/**
 * Get optimized image URL based on size needed
 * @param {string} imagePath - Original image path
 * @param {string} size - 'thumbnail', 'medium', 'large', or 'original'
 * @returns {string} - Optimized image URL
 */
function getOptimizedImageUrl(imagePath, size = 'medium') {
    if (!imagePath) return null;
    
    // If already a full URL, return as is
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
        return imagePath;
    }
    
    // If it's already an optimized WebP, return as is
    if (imagePath.includes('-thumb.webp') || 
        imagePath.includes('-medium.webp') || 
        imagePath.includes('-large.webp') ||
        imagePath.includes('-original.webp')) {
        return imagePath;
    }
    
    // Extract base filename
    const pathParts = imagePath.split('/');
    const filename = pathParts[pathParts.length - 1];
    const baseFilename = filename.replace(/\.[^/.]+$/, ''); // Remove extension
    
    // Return appropriate size
    const sizeSuffix = size === 'thumbnail' ? '-thumb' : 
                      size === 'medium' ? '-medium' : 
                      size === 'large' ? '-large' : '-original';
    
    return `/uploads/${baseFilename}${sizeSuffix}.webp`;
}

module.exports = {
    optimizeImage,
    generateImageSizes,
    getOptimizedImageUrl,
    IMAGE_SIZES
};

