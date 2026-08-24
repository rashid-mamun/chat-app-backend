const { Resend } = require('resend');

let resend;

const getClient = () => {
    if (!process.env.RESEND_API_KEY) {
        throw new Error('RESEND_API_KEY is required');
    }

    if (!resend) resend = new Resend(process.env.RESEND_API_KEY);
    return resend;
};

const sendPasswordResetEmail = async ({ email, resetUrl }) => {
    const { error } = await getClient().emails.send({
        from: process.env.MAIL_FROM,
        to: email,
        subject: 'Reset your ChatApp password',
        text: `Reset your password within 15 minutes: ${resetUrl}`,
        html: `<p>Reset your password within 15 minutes:</p><p><a href="${resetUrl}">Reset password</a></p>`
    });

    if (error) throw new Error(`Resend email failed: ${error.message}`);
};

module.exports = { sendPasswordResetEmail };
