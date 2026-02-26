const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    action: {
        type: String,
        required: true,
        enum: [
            'PRODUCT_CREATE',
            'PRODUCT_UPDATE',
            'PRODUCT_DELETE',
            'ORDER_UPDATE',
            'ORDER_DELIVER',
            'USER_DELETE',
            'USER_UPDATE',
            'SETTINGS_UPDATE',
            'DAILY_DEAL_CREATE',
            'DAILY_DEAL_UPDATE',
            'DAILY_DEAL_DELETE',
            'FILE_UPLOAD',
            'ADMIN_ACCESS',
        ],
    },
    resourceType: {
        type: String,
        required: true,
    },
    resourceId: {
        type: String,
    },
    details: {
        type: mongoose.Schema.Types.Mixed,
    },
    ipAddress: {
        type: String,
    },
    userAgent: {
        type: String,
    },
    timestamp: {
        type: Date,
        default: Date.now,
    },
}, {
    timestamps: true,
});

// Index for faster queries
auditLogSchema.index({ user: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ timestamp: -1 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);
module.exports = AuditLog;

