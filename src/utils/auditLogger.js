const pool = require("../config/db");
const { auditQueue } = require("../config/queue");

/**
 * Audit logger (DB + Queue safe)
 */
const logAudit = async (userId, action, ip) => {
  try {
    // 1. Always write to DB (source of truth)
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, ip_address)
       VALUES ($1, $2, $3)`,
      [userId, action, ip]
    );

    // 2. Queue is OPTIONAL (never block main flow)
    try {
      await auditQueue.add("audit-log", {
        userId,
        action,
        ip,
        timestamp: new Date().toISOString(),
      });
    } catch (queueErr) {
      console.log("Audit queue failed (non-blocking):", queueErr.message);
    }

  } catch (error) {
    console.log("Audit DB failed:", error.message);
  }
};

module.exports = logAudit;