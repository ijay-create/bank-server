const { Worker } = require("bullmq");
const nodemailer = require("nodemailer");

const connection = {
  host: "127.0.0.1",
  port: 6379,
};

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const emailWorker = new Worker(
  "emailQueue",
  async (job) => {
    const { to, subject, html } = job.data;

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject,
      html,
    });
  },
  { connection }
);

console.log("Email Worker Running");

module.exports = emailWorker;