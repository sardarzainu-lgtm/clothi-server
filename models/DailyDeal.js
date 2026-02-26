const mongoose = require('mongoose');

const dailyDealSchema = new mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'Product',
    },
    endTime: {
        type: Date,
        required: true,
    },
    discountPercentage: {
        type: Number,
        required: false,
        min: 0,
        max: 100,
        default: 0,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User',
    },
}, {
    timestamps: true,
});

const DailyDeal = mongoose.model('DailyDeal', dailyDealSchema);
module.exports = DailyDeal;

