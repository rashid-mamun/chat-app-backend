const nodemailer = require('nodemailer');

let transporter;

const getTransporter = () => {
    if (!transporter) {
        transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT || 587),
            secure: process.env.SMTP_SECURE === 'true',
            auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        });
    }
    return transporter;
};

const sendPasswordResetEmail = async ({ email, resetUrl }) => {
    await getTransporter().sendMail({
        from: process.env.MAIL_FROM,
        to: email,
        subject: 'Reset your ChatApp password',
        text: `Reset your password within 15 minutes: ${resetUrl}`,
        html: `<p>Reset your password within 15 minutes:</p><p><a href="${resetUrl}">Reset password</a></p>`
    });
};

module.exports = { sendPasswordResetEmail };
