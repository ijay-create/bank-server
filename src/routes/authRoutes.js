const express = require("express");

const {
  registerUser,
  loginUser,
  forgotPassword,
  resetPassword,
  refreshToken,
  logoutAll,
} = require("../controllers/authController");

const protect = require("../middleware/authMiddleware");

const router = express.Router();

/* AUTH */
router.post("/register", registerUser);
router.post("/login", loginUser);

/* PASSWORD */
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);

/* TOKEN */
router.post("/refresh-token", refreshToken);

/* LOGOUT ALL */
router.post("/logout-all", protect, logoutAll);

module.exports = router;