const mongoose = require('mongoose');

const dummyWalletSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'user',
            required: true
        },
        phoneNumber: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },
        pinHash: {
            type: String,
            required: true
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model('DummyWallet', dummyWalletSchema);
