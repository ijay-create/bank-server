const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");

/* ---------------- ACCOUNT NUMBER ---------------- */
const generateAccountNumber = () => {
  return Math.floor(1000000000 + Math.random() * 9000000000).toString();
};

/* =========================
   REGISTER
========================= */
exports.registerUser = async (req, res) => {
  try {
    const { full_name, email, password } = req.body || {};

    if (!full_name || !email || !password) {
      return res.status(400).json({ message: "All fields required" });
    }

    const existing = await pool.query(
      "SELECT id FROM users WHERE email=$1",
      [email]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashed = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `INSERT INTO users
      (full_name, email, password, account_number, balance, role, token_version)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING id, full_name, email, account_number, balance, role, token_version`,
      [
        full_name,
        email,
        hashed,
        generateAccountNumber(),
        0,
        "user",
        0,
      ]
    );

    const user = result.rows[0];

    const accessToken = jwt.sign(
      {
        id: user.id,
        role: user.role || "user",
        tv: user.token_version,
      },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    const refreshToken = jwt.sign(
      {
        id: user.id,
        role: user.role || "user",
        tv: user.token_version,
      },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: "7d" }
    );

    await pool.query(
      "UPDATE users SET refresh_token=$1 WHERE id=$2",
      [refreshToken, user.id]
    );

    return res.status(201).json({
      user,
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.log("REGISTER ERROR:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

/* =========================
   LOGIN
========================= */
exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }

    const userResult = await pool.query(
      "SELECT * FROM users WHERE email=$1",
      [email]
    );

    if (!userResult.rows.length) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = userResult.rows[0];

    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const accessToken = jwt.sign(
      {
        id: user.id,
        role: user.role || "user",
        tv: user.token_version,
      },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    const refreshToken = jwt.sign(
      {
        id: user.id,
        role: user.role || "user",
        tv: user.token_version,
      },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: "7d" }
    );

    await pool.query(
      "UPDATE users SET refresh_token=$1 WHERE id=$2",
      [refreshToken, user.id]
    );

    return res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        account_number: user.account_number,
        balance: user.balance,
        role: user.role || "user",
      },
    });
  } catch (error) {
    console.log("LOGIN ERROR:", error);
    return res.status(500).json({ message: "Login failed" });
  }
};

/* =========================
   REFRESH TOKEN
========================= */
exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body || {};

    if (!refreshToken) {
      return res.status(401).json({ message: "No refresh token" });
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch (err) {
      return res.status(403).json({ message: "Invalid refresh token" });
    }

    const userResult = await pool.query(
      "SELECT * FROM users WHERE id=$1",
      [decoded.id]
    );

    const user = userResult.rows[0];

    if (!user || user.refresh_token !== refreshToken) {
      return res.status(403).json({ message: "Invalid refresh token" });
    }

    const newAccessToken = jwt.sign(
      {
        id: user.id,
        role: user.role || "user",
        tv: user.token_version,
      },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    return res.json({ accessToken: newAccessToken });
  } catch (error) {
    console.log("REFRESH ERROR:", error);
    return res.status(500).json({ message: "Token error" });
  }
};

/* =========================
   LOGOUT ALL
========================= */
exports.logoutAll = async (req, res) => {
  try {
    await pool.query(
      `UPDATE users
       SET token_version = token_version + 1,
           refresh_token = NULL
       WHERE id = $1`,
      [req.user.id]
    );

    return res.status(200).json({
      success: true,
      message: "Logged out from all devices",
    });
  } catch (error) {
    console.error("LOGOUT ALL ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Logout failed",
    });
  }
};

/* =========================
   FORGOT PASSWORD
========================= */
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body || {};

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Forgot password endpoint working",
    });
  } catch (error) {
    console.error("FORGOT PASSWORD ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

/* =========================
   RESET PASSWORD
========================= */
exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body || {};

    if (!token || !password) {
      return res.status(400).json({
        success: false,
        message: "Token and password are required",
      });
    }
    
    return res.status(200).json({
      success: true,
      message: "Reset password endpoint working",
    });
  } catch (error) {
    console.error("RESET PASSWORD ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};