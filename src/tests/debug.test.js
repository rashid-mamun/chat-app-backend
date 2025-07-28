const request = require('supertest');
const app = require('../../server');
const User = require('../models/User');
const bcrypt = require('bcryptjs');

describe('Debug Login Test', () => {
    beforeEach(async () => {
        await User.deleteMany({});
    });

    it('should login successfully with valid credentials', async () => {
        // Test bcrypt directly
        const testPassword = 'Test123!@#';
        const hash = await bcrypt.hash(testPassword, 12);
        const directCompare = await bcrypt.compare(testPassword, hash);
        console.log('Direct bcrypt comparison:', directCompare);

        // Create a user with normal flow (let pre-save middleware handle hashing)
        const user = await User.create({
            username: 'testuser',
            email: 'test@example.com',
            password: 'Test123!@#'
        });

        console.log('Created user:', user._id);
        console.log('Password hash from user object:', user.password);

        // Test password comparison directly
        const foundUser = await User.findOne({ email: 'test@example.com' }).select('+password');
        console.log('Found user password:', foundUser.password);
        const passwordMatch = await foundUser.comparePassword('Test123!@#');
        console.log('Password match:', passwordMatch);

        // Test bcrypt comparison with found user password
        const bcryptCompare = await bcrypt.compare('Test123!@#', foundUser.password);
        console.log('Bcrypt comparison with found user:', bcryptCompare);

        // Test login
        const response = await request(app)
            .post('/api/v1/auth/login')
            .send({
                email: 'test@example.com',
                password: 'Test123!@#'
            });

        console.log('Response status:', response.status);
        console.log('Response body:', JSON.stringify(response.body, null, 2));

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
    });
}); 