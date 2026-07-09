const nodemailer = require("nodemailer");
const { isEmailDeliveryConfigured } = require("../config/env");

let cachedTransporter = null;

const getTransporter = () => {
  if (!isEmailDeliveryConfigured()) return null;

  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
        : undefined,
    });
  }

  return cachedTransporter;
};

const sendPasswordResetEmail = async ({ to, resetUrl }) => {
  const transporter = getTransporter();

  if (!transporter) {
    console.warn(
      "[email] SMTP is not configured — skipping password-reset email delivery. " +
        "Configure SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASSWORD/SMTP_FROM in backend/.env to enable delivery."
    );
    return { delivered: false };
  }

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject: "Reset your Rockstar password",
      text: `We received a request to reset your Rockstar password. This link expires in ${process.env.PASSWORD_RESET_EXPIRES_MINUTES} minutes:\n\n${resetUrl}\n\nIf you didn't request this, you can safely ignore this email.`,
      html: `<p>We received a request to reset your Rockstar password. This link expires in ${process.env.PASSWORD_RESET_EXPIRES_MINUTES} minutes.</p><p><a href="${resetUrl}">Reset your password</a></p><p>If you didn't request this, you can safely ignore this email.</p>`,
    });
    return { delivered: true };
  } catch (err) {
    console.error("[email] Failed to send password-reset email:", err.message);
    return { delivered: false };
  }
};

module.exports = { sendPasswordResetEmail };
