const AuditLog = require('../models/AuditLog.js');

/**
 * Audit logging middleware for admin actions
 * Logs all admin actions for security and compliance
 */
const auditLog = (action, resourceType) => {
    return async (req, res, next) => {
        // Only log if user is admin and AuditLog model is available
        if (req.user && req.user.isAdmin) {
            try {
                // Check if AuditLog model is available (might not be if MongoDB not connected)
                if (!AuditLog) {
                    return next();
                }

                const auditData = {
                    user: req.user._id,
                    action,
                    resourceType,
                    resourceId: req.params.id || req.body.id || null,
                    details: {
                        method: req.method,
                        path: req.path,
                        body: sanitizeBody(req.body), // Remove sensitive data
                    },
                    ipAddress: req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown',
                    userAgent: req.headers['user-agent'] || 'unknown',
                };

                // Log asynchronously to not block the request
                AuditLog.create(auditData).catch(err => {
                    console.error('Audit log error:', err);
                });
            } catch (error) {
                // Don't fail the request if audit logging fails
                console.error('Audit logging error:', error);
            }
        }
        next();
    };
};

/**
 * Sanitize request body to remove sensitive information
 */
function sanitizeBody(body) {
    if (!body || typeof body !== 'object') {
        return body;
    }

    const sanitized = { ...body };
    const sensitiveFields = ['password', 'token', 'secret', 'creditCard', 'cvv', 'ssn'];

    for (const field of sensitiveFields) {
        if (sanitized[field]) {
            sanitized[field] = '[REDACTED]';
        }
    }

    return sanitized;
}

module.exports = { auditLog };

