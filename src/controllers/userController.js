const pool = require("../config/db");
const redis = require("../config/redis");

exports.getUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    /* =========================
       CHECK CACHE FIRST
    ========================= */
    const cachedUser = await redis.get(`user:${userId}`);

    if (cachedUser) {
      return res.status(200).json(JSON.parse(cachedUser));
    }

    /* =========================
       FETCH FROM DB
    ========================= */
    const userResult = await pool.query(
      `SELECT
        id,
        full_name,
        email,
        account_number,
        balance,
        role
       FROM users
       WHERE id = $1`,
      [userId]
    );

    const user = userResult.rows[0];

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    /* =========================
       CACHE RESULT (5 MIN)
    ========================= */
    await redis.setEx(
      `user:${userId}`,
      300,
      JSON.stringify(user)
    );

    return res.status(200).json(user);

  } catch (error) {
    console.log("PROFILE ERROR:", error);

    return res.status(500).json({
      message: "Could not fetch profile",
    });
  }
};