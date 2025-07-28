const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Message must have a sender']
    },
    content: {
        type: String,
        trim: true,
        maxlength: [1000, 'Message cannot exceed 1000 characters']
    },
    fileUrl: {
        type: String,
        trim: true
    },
    fileType: {
        type: String,
        enum: ['image', 'video', 'audio', 'document', 'other']
    },
    fileName: {
        type: String,
        trim: true
    },
    fileSize: {
        type: Number,
        max: [10 * 1024 * 1024, 'File size cannot exceed 10MB']
    },
    chatType: {
        type: String,
        enum: ['private', 'group'],
        required: [true, 'Chat type is required']
    },
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: function () {
            return this.chatType === 'private';
        }
    },
    group: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group',
        required: function () {
            return this.chatType === 'group';
        }
    },
    readBy: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        readAt: {
            type: Date,
            default: Date.now
        }
    }],
    editedAt: {
        type: Date
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    deletedAt: {
        type: Date
    },
    reactions: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        reaction: {
            type: String,
            enum: ['like', 'love', 'laugh', 'sad', 'angry'],
            required: true
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    isPinned: {
        type: Boolean,
        default: false
    },
    pinnedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    pinnedAt: {
        type: Date
    },
    isCompressed: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes for better query performance
messageSchema.index({ sender: 1, createdAt: -1 });
messageSchema.index({ recipient: 1, createdAt: -1 });
messageSchema.index({ group: 1, createdAt: -1 });
messageSchema.index({ chatType: 1, createdAt: -1 });
messageSchema.index({ sender: 1, recipient: 1, createdAt: -1 });
messageSchema.index({ group: 1, createdAt: -1, isDeleted: 1 });
messageSchema.index({ content: 'text' });
messageSchema.index({ isPinned: 1, chatType: 1 });

// Virtual for read status
messageSchema.virtual('isRead').get(function () {
    return this.readBy.length > 0;
});

// Instance method to mark as read
messageSchema.methods.markAsRead = async function (userId) {
    const alreadyRead = this.readBy.find(read => read.user.toString() === userId.toString());
    if (!alreadyRead) {
        this.readBy.push({ user: userId });
        await this.save();
    }
};

// Instance method to soft delete
messageSchema.methods.softDelete = async function () {
    this.isDeleted = true;
    this.deletedAt = Date.now();
    await this.save();
};

module.exports = mongoose.model('Message', messageSchema);
