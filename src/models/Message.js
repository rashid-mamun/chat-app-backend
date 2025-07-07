const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String }, // Text or emoji content
    fileUrl: { type: String }, // URL for file uploads
    fileType: { type: String }, // e.g., image, video, document
    chatType: { type: String, enum: ['private', 'group'], required: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // For private chats
    group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' }, // For group chats
    timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Message', messageSchema);