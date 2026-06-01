const pool = require("../config/db");

/* =========================
   GET ALL USERS
========================= */
exports.getAllUsers = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        id,
        full_name,
        email,
        account_number,
        balance,
        role,
        status,
        created_at
       FROM users
       ORDER BY created_at DESC`
    );

    return res.status(200).json(result.rows);
  } catch (error) {
    console.log("GET USERS ERROR:", error);

    return res.status(500).json({
      message: "Could not fetch users",
    });
  }
};

/* =========================
   FREEZE / UNFREEZE ACCOUNT
========================= */
exports.toggleFreezeAccount = async (req, res) => {
  try {
    const { userId } = req.params;

    const userResult = await pool.query(
      "SELECT id, status FROM users WHERE id = $1",
      [userId]
    );

    if (!userResult.rows.length) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const user = userResult.rows[0];

    const newStatus = user.status === "active" ? "frozen" : "active";

    await pool.query(
      "UPDATE users SET status = $1 WHERE id = $2",
      [newStatus, userId]
    );

    return res.status(200).json({
      message: `Account ${newStatus}`,
      status: newStatus,
    });
  } catch (error) {
    console.log("FREEZE ERROR:", error);

    return res.status(500).json({
      message: "Could not update account status",
    });
  }
};

/* =========================
   FLAGGED TRANSACTIONS
========================= */
exports.getFlaggedTransactions = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        id,
        sender_id,
        receiver_id,
        amount,
        reference,
        flagged,
        created_at
       FROM transactions
       WHERE flagged = true
       ORDER BY created_at DESC`
    );

    return res.status(200).json(result.rows);
  } catch (error) {
    console.log("FLAGGED ERROR:", error);

    return res.status(500).json({
      message: "Could not fetch flagged transactions",
    });
  }
};

/* =========================
   RISK TRANSACTIONS (NEW)
========================= */
exports.getRiskTransactions = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT *
       FROM transactions
       ORDER BY risk_score DESC`
    );

    return res.status(200).json(result.rows);
  } catch (error) {
    console.log("RISK ERROR:", error);

    return res.status(500).json({
      message: "Could not fetch risk data",
    });
  }
};

/* =========================
   AUDIT LOGS
========================= */
exports.getAuditLogs = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT *
       FROM audit_logs
       ORDER BY created_at DESC`
    );

    return res.status(200).json(result.rows);
  } catch (error) {
    console.log("AUDIT LOG ERROR:", error);

    return res.status(500).json({
      message: "Could not fetch audit logs",
    });
  }
};

/* =========================
   LOGIN SESSIONS
========================= */
exports.getLoginSessions = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        id,
        user_id,
        ip_address,
        user_agent,
        is_suspicious,
        created_at
       FROM login_sessions
       ORDER BY created_at DESC`
    );

    return res.status(200).json(result.rows);
  } catch (error) {
    console.log("LOGIN SESSIONS ERROR:", error);

    return res.status(500).json({
      message: "Could not fetch login sessions",
    });
  }
};