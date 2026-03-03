/**
 * Optional Cloudinary upload helper.
 * When CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET are set,
 * use this to upload images so they persist across redeploys (e.g. on Hostinger).
 */
const { Readable } = require('stream');

function isCloudinaryConfigured() {
    return !!(
        process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_SECRET
    );
}

/**
 * Upload an image buffer to Cloudinary and return URLs matching our existing API shape.
 * @param {Buffer} buffer - Image file buffer
 * @param {string} originalName - Original filename (for format)
 * @returns {Promise<{ imageUrl: string, images: { thumbnail, medium, large, original } }>}
 */
function uploadBufferToCloudinary(buffer, originalName) {
    if (!isCloudinaryConfigured()) {
        throw new Error('Cloudinary is not configured');
    }

    const cloudinary = require('cloudinary').v2;
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            {
                folder: 'ecommerce',
                resource_type: 'image',
            },
            (err, result) => {
                if (err) return reject(err);
                if (!result || !result.secure_url) return reject(new Error('No URL from Cloudinary'));

                const base = result.secure_url;
                // Cloudinary URL format: .../upload/v123/folder/public_id.jpg
                // Insert transformations before /v123/ for different sizes
                const insertPos = base.indexOf('/upload/') + 8; // after '/upload/'
                const prefix = base.slice(0, insertPos);
                const suffix = base.slice(insertPos); // e.g. v123/ecommerce/xxx.jpg

                const thumb = `${prefix}w_300,h_300,c_fill,f_auto,q_auto/${suffix}`;
                const medium = `${prefix}w_800,h_800,c_limit,f_auto,q_auto/${suffix}`;
                const large = `${prefix}w_1200,h_1200,c_limit,f_auto,q_auto/${suffix}`;

                resolve({
                    imageUrl: medium,
                    images: {
                        thumbnail: thumb,
                        medium,
                        large,
                        original: base,
                    },
                    thumbnail: thumb,
                    medium,
                    large,
                    original: base,
                });
            }
        );

        const readStream = Readable.from(buffer);
        readStream.pipe(stream);
    });
}

module.exports = {
    isCloudinaryConfigured,
    uploadBufferToCloudinary,
};
