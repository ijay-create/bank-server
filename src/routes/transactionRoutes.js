const express = require("express");
const protect = require("../middleware/authMiddleware");

const {
  requestTransferOTP,
  transferMoney,
  getTransactions,
} = require("../controllers/transactionController");

const router = express.Router();

/* OTP */
router.post("/request-otp", protect, requestTransferOTP);

/* TRANSFER */
router.post("/transfer", protect, transferMoney);

/* TRANSACTIONS (SINGLE CLEAN ENDPOINT) */
router.get("/", protect, getTransactions);

module.exports = router;