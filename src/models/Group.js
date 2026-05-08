const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Group name is required'],
        trim: true,
        maxlength: [50, 'Group name cannot exceed 50 characters']
    },
    members: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    admins: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    avatar: {
        type: String,
        default: null
    },
    privacy: {
        type: String,
        enum: ['public', 'private'],
        default: 'public'
    },
    inviteCode: {
        type: String,
        unique: true
    },
    joinRequests: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
        createdAt: { type: Date, default: Date.now }
    }],
    invites: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        inviter: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
        createdAt: { type: Date, default: Date.now }
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Group', groupSchema);