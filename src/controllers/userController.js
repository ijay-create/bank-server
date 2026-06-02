const pool = require("../config/db");
const redis = require("../config/redis");

exports.getUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    /* =========================
       TRY CACHE FIRST
    ========================= */
    try {
      const cachedUser = await redis.get(`user:${userId}`);

      if (cachedUser) {
        return res.status(200).json(JSON.parse(cachedUser));
      }
    } catch (redisError) {
      console.log("Redis read error:", redisError.message);
    }

    /* =========================
       FETCH FROM DATABASE
    ========================= */
    const userResult = await pool.query(
      `
      SELECT
        id,
        full_name,
        email,
        account_number,
        balance,
        role
      FROM users
      WHERE id = $1
      `,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const user = userResult.rows[0];

    /* =========================
       CACHE RESULT (NON-BLOCKING)
    ========================= */
    try {
      await redis.setEx(
        `user:${userId}`,
        300,
        JSON.stringify(user)
      );
    } catch (redisError) {
      console.log("Redis write error:", redisError.message);
    }

    return res.status(200).json(user);

  } catch (error) {
    console.log("PROFILE ERROR:", error);

    return res.status(500).json({
      message: "Could not fetch profile",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : undefined,
    });
  }
};
