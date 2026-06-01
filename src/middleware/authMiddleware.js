const jwt = require("jsonwebtoken");
const pool = require("../config/db");

const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Not authorized, no token",
      });
    }

    const token = authHeader.split(" ")[1];

    let decoded;

    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({
        message:
          err.name === "TokenExpiredError"
            ? "Token expired, please login again"
            : "Invalid token",
      });
    }

    const userResult = await pool.query(
      "SELECT id, email, role, token_version FROM users WHERE id = $1",
      [decoded.id]
    );

    if (!userResult.rows.length) {
      return res.status(401).json({
        message: "User not found",
      });
    }

    const user = userResult.rows[0];

    // OPTIONAL SAFE CHECK (ONLY IF YOU ADD tv IN JWT)
    if (
      decoded.tv !== undefined &&
      user.token_version !== decoded.tv
    ) {
      return res.status(401).json({
        message: "Session expired. Please login again.",
      });
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    next();
  } catch (error) {
    console.log("AUTH ERROR:", error);

    return res.status(500).json({
      message: "Server auth error",
    });
  }
};

module.exports = protect;