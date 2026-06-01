const express = require("express");

const protect = require(
  "../middleware/authMiddleware"
);

const {
  getUserProfile,
} = require(
  "../controllers/userController"
);

const router = express.Router();

router.get(
  "/profile",
  protect,
  getUserProfile
);

module.exports = router;