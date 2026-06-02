const pool = require("../config/db");
const redis = require("../config/redis");
const logAudit = require("../utils/auditLogger");
const generateOTP = require("../utils/generateOTP");
const sendEmail = require("../utils/sendEmail");
const { getIO } = require("../socket");

/* =========================
   REFERENCE GENERATOR
========================= */
const generateReference = () => {
  return (
    "TRX-" +
    Date.now() +
    "-" +
    Math.floor(Math.random() * 1000)
  );
};

/* =========================
   SEND OTP
========================= */
exports.requestTransferOTP = async (req, res) => {
  try {
    const { receiverAccountNumber, amount } = req.body;

    if (!receiverAccountNumber || !amount) {
      return res.status(400).json({ message: "All fields required" });
    }

    const senderResult = await pool.query(
      "SELECT * FROM users WHERE id = $1",
      [req.user.id]
    );

    if (!senderResult.rows.length) {
      return res.status(404).json({ message: "User not found" });
    }

    const sender = senderResult.rows[0];

    const receiverResult = await pool.query(
      "SELECT * FROM users WHERE account_number = $1",
      [receiverAccountNumber]
    );

    if (!receiverResult.rows.length) {
      return res.status(404).json({ message: "Recipient not found" });
    }

    const otp = generateOTP();
    const expiry = new Date(Date.now() + 5 * 60 * 1000);

    await pool.query(
      `UPDATE users
       SET otp = $1, otp_expires = $2
       WHERE id = $3`,
      [otp, expiry, sender.id]
    );

    await sendEmail(
      sender.email,
      "Bank Transfer OTP",
      `<h2>Your OTP Code</h2><p>${otp}</p><p>Expires in 5 minutes.</p>`
    );

    return res.status(200).json({ message: "OTP sent to email" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Could not send OTP" });
  }
};

/* =========================
   TRANSFER MONEY (FULL FIXED + RISK + CACHE SAFE)
========================= */
exports.transferMoney = async (req, res) => {
  const client = await pool.connect();

  try {
    const { receiverAccountNumber, amount, otp } = req.body;

    if (!receiverAccountNumber || !amount || !otp) {
      return res.status(400).json({ message: "All fields required" });
    }

    await client.query("BEGIN");

    /* =========================
       LOCK SENDER
    ========================= */
    const senderResult = await client.query(
      "SELECT * FROM users WHERE id = $1 FOR UPDATE",
      [req.user.id]
    );

    if (!senderResult.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "User not found" });
    }

    const sender = senderResult.rows[0];

    /* =========================
       OTP VALIDATION
    ========================= */
    if (sender.otp !== otp) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Invalid OTP" });
    }

    if (!sender.otp_expires || new Date() > new Date(sender.otp_expires)) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "OTP expired" });
    }

    /* =========================
       LOCK RECEIVER
    ========================= */
    const receiverResult = await client.query(
      "SELECT * FROM users WHERE account_number = $1 FOR UPDATE",
      [receiverAccountNumber]
    );

    if (!receiverResult.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Recipient not found" });
    }

    const receiver = receiverResult.rows[0];

    if (sender.id === receiver.id) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Cannot transfer to yourself" });
    }

    /* =========================
       ACCOUNT STATUS CHECK
    ========================= */
    if (sender.status === "frozen") {
      await client.query("ROLLBACK");
      return res.status(403).json({ message: "Account frozen" });
    }

    if (receiver.status === "frozen") {
      await client.query("ROLLBACK");
      return res.status(403).json({ message: "Recipient frozen" });
    }

    /* =========================
       DAILY LIMIT CHECK
    ========================= */
    const todayTotalResult = await client.query(
      `SELECT COALESCE(SUM(amount),0) as total
       FROM transactions
       WHERE sender_id = $1
       AND created_at::date = CURRENT_DATE`,
      [sender.id]
    );

    const todayTotal = Number(todayTotalResult.rows[0].total);

    let dailyLimit = 100000;
    if (sender.tier === "premium") dailyLimit = 500000;
    else if (sender.tier === "vip") dailyLimit = 2000000;

    if (todayTotal + Number(amount) > dailyLimit) {
      await client.query("ROLLBACK");
      return res.status(403).json({
        message: "Daily transaction limit exceeded",
      });
    }

    /* =========================
       VELOCITY CHECK
    ========================= */
    const recentTransfers = await client.query(
      `SELECT COUNT(*) as count
       FROM transactions
       WHERE sender_id = $1
       AND created_at > NOW() - INTERVAL '10 minutes'`,
      [sender.id]
    );

    const transferCount = Number(recentTransfers.rows[0].count);

    if (transferCount >= 5) {
      await client.query("ROLLBACK");
      return res.status(403).json({
        message: "Too many transfers in short time",
      });
    }

    /* =========================
       RISK ENGINE
    ========================= */
    let riskScore = 0;

    if (Number(amount) > 200000) riskScore += 30;
    if (todayTotal > dailyLimit * 0.7) riskScore += 20;
    if (transferCount >= 3) riskScore += 25;
    if (sender.status === "frozen") riskScore += 100;

    if (riskScore >= 70) {
      await client.query("ROLLBACK");
      return res.status(403).json({
        message: "Transaction blocked due to risk detection",
        riskScore,
      });
    }

    /* =========================
       BALANCES UPDATE
    ========================= */
    const newSenderBalance =
      Number(sender.balance) - Number(amount);

    const newReceiverBalance =
      Number(receiver.balance) + Number(amount);

    await client.query(
      "UPDATE users SET balance = $1 WHERE id = $2",
      [newSenderBalance, sender.id]
    );

    await client.query(
      "UPDATE users SET balance = $1 WHERE id = $2",
      [newReceiverBalance, receiver.id]
    );

    /* =========================
       TRANSACTION INSERT (FIXED)
    ========================= */
    const reference = generateReference();
    const isFlagged = riskScore >= 40;

    await client.query(
      `INSERT INTO transactions
       (sender_id, receiver_id, amount, transaction_type, reference, flagged, risk_score)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        sender.id,
        receiver.id,
        amount,
        "transfer",
        reference,
        isFlagged,
        riskScore,
      ]
    );

    /* =========================
       CLEAR OTP
    ========================= */
    await client.query(
      `UPDATE users
       SET otp = NULL, otp_expires = NULL
       WHERE id = $1`,
      [sender.id]
    );

    await client.query("COMMIT");

    /* =========================
       CLEAR CACHE (SAFE)
    ========================= */
    try {
      await redis.del(`user:${sender.id}`);
      await redis.del(`user:${receiver.id}`);
      await redis.del(`transactions:${sender.id}`);
      await redis.del(`transactions:${receiver.id}`);

      console.log("CACHE HIT/MISS TRACKING ENABLED");
    } catch (err) {
      console.log("CACHE ERROR:", err.message);
    }

    /* =========================
       SOCKET EVENTS
    ========================= */
    try {
      const io = getIO();

      io.to(receiver.id.toString()).emit("notification", {
        message: `You received ₦${amount}`,
        amount,
        reference,
      });

      io.to(sender.id.toString()).emit("notification", {
        message: `Transfer successful`,
        amount,
        reference,
      });
    } catch (err) {
      console.log("Socket error:", err.message);
    }

    /* =========================
       AUDIT LOG
    ========================= */
    await logAudit(
      sender.id,
      `Transferred ₦${amount} to ${receiver.account_number}`,
      req.ip
    );

    return res.status(200).json({
      message: isFlagged
        ? "Transfer successful but flagged"
        : "Transfer successful",
      reference,
      flagged: isFlagged,
      riskScore,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.log("TRANSFER ERROR:", error);

    return res.status(500).json({
      message: "Transfer failed",
      error: error.message,
    });
  } finally {
    client.release();
  }
};

/* =========================
   GET TRANSACTIONS (CACHE SAFE)
========================= */
exports.getTransactions = async (req, res) => {
  try {
    const userId = req.user.id;
    const cacheKey = `transactions:${userId}`;

    /* =========================
       CACHE LOOKUP
    ========================= */
    try {
      const cached = await redis.get(cacheKey);

      if (cached) {
        return res.status(200).json(JSON.parse(cached));
      }
    } catch (redisError) {
      console.log(
        "Redis read error:",
        redisError.message
      );
    }

    /* =========================
       DATABASE QUERY
    ========================= */
    const result = await pool.query(
      `
      SELECT
        t.*,
        sender.full_name AS sender_name,
        receiver.full_name AS receiver_name,
        CASE
          WHEN t.sender_id = $1 THEN 'debit'
          WHEN t.receiver_id = $1 THEN 'credit'
        END AS type
      FROM transactions t
      LEFT JOIN users sender
        ON sender.id = t.sender_id
      LEFT JOIN users receiver
        ON receiver.id = t.receiver_id
      WHERE
        t.sender_id = $1
        OR t.receiver_id = $1
      ORDER BY t.created_at DESC
      `,
      [userId]
    );

    const transactions = result.rows;

    /* =========================
       CACHE RESULT
    ========================= */
    try {
      await redis.setEx(
        cacheKey,
        120,
        JSON.stringify(transactions)
      );
    } catch (redisError) {
      console.log(
        "Redis write error:",
        redisError.message
      );
    }

    return res.status(200).json(transactions);

  } catch (error) {
    console.log(
      "GET TRANSACTIONS ERROR:",
      error
    );

    return res.status(500).json({
      message: "Could not fetch transactions",
    });
  }
};