const mongoose = require('mongoose');
const Group = require('./src/models/Group');
const User = require('./src/models/User');

require('dotenv').config();

async function test() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const groups = await Group.find()
      .populate('members', 'username email avatar isOnline status lastSeen')
      .populate('admins', 'username email avatar')
      .lean();
      
  console.log(JSON.stringify(groups, null, 2));
  process.exit(0);
}

test();
