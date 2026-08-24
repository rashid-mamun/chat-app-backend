const mockSend = jest.fn();

jest.mock('resend', () => ({
    Resend: jest.fn(() => ({
        emails: { send: mockSend }
    }))
}));

const { sendPasswordResetEmail } = require('../../services/emailService');

describe('Email service', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        mockSend.mockReset();
        process.env.RESEND_API_KEY = 're_test_key';
        process.env.MAIL_FROM = 'ChatApp <no-reply@example.com>';
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    it('sends password reset email through Resend', async () => {
        mockSend.mockResolvedValue({ data: { id: 'email-id' }, error: null });

        await sendPasswordResetEmail({
            email: 'user@example.com',
            resetUrl: 'https://app.example.com/reset-password/token'
        });

        expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({
            from: process.env.MAIL_FROM,
            to: 'user@example.com',
            subject: 'Reset your ChatApp password'
        }));
    });

    it('surfaces a Resend API error', async () => {
        mockSend.mockResolvedValue({ data: null, error: { message: 'invalid sender' } });

        await expect(sendPasswordResetEmail({
            email: 'user@example.com',
            resetUrl: 'https://app.example.com/reset-password/token'
        })).rejects.toThrow('Resend email failed: invalid sender');
    });
});
