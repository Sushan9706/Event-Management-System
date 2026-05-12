const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // use SSL
    pool: true,   // use connection pooling for faster multiple sends
    auth: {
        user: 'ems.support.team.nepal@gmail.com',
        pass: 'nimfuvfnkimygrrf' // App password provided by user
    }
});

exports.sendResetCode = async (email, code) => {
    const mailOptions = {
        from: '"EMS Support Team" <ems.support.team.nepal@gmail.com>',
        to: email,
        subject: 'Password Reset Verification Code',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
                <h2 style="color: #333; text-align: center;">Reset Your Password</h2>
                <p>Hello,</p>
                <p>You requested to reset your password for your EMS account. Use the 6-digit verification code below to proceed:</p>
                <div style="background-color: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #4a4a4a; margin: 20px 0; border-radius: 5px;">
                    ${code}
                </div>
                <p>This code <strong>expires in 10 minutes</strong>.</p>
                <p>If you did not request this, please ignore this email or contact support if you have concerns.</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="font-size: 12px; color: #888; text-align: center;">
                    COPYRIGHT © 2026 EMS. ALL RIGHTS RESERVED.
                </p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        return { success: true };
    } catch (error) {
        console.error('Error sending email:', error);
        return { success: false, error };
    }
};
