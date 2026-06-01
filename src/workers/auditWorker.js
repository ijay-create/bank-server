const { Worker } = require("bullmq");
const pool = require("../config/db");

const connection = {
  host: "127.0.0.1",
  port: 6379,
};

const auditWorker = new Worker(
  "auditQueue",
  async (job) => {
    const { userId, action, ip } = job.data;

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, ip_address)
       VALUES ($1, $2, $3)`,
      [userId, action, ip]
    );
  },
  { connection }
);

console.log("Audit Worker Running");

module.exports = auditWorker;