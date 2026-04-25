const mongoose = require('mongoose');
const User = require('./src/models/User');
const dotenv = require('dotenv');

dotenv.config();

const listUsers = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const users = await User.find({}).select('username email');
        console.log('All users in DB:');
        console.log(JSON.stringify(users, null, 2));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

listUsers();
