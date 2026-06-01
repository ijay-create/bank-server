const express = require("express");

const protect = require("../middleware/authMiddleware");
const adminOnly = require("../middleware/adminMiddleware");

const adminController = require("../controllers/adminController");

const router = express.Router();

/* =========================
   ADMIN USERS
========================= */
router.get(
  "/users",
  protect,
  adminOnly,
  adminController.getAllUsers
);

/* =========================
   FREEZE ACCOUNT
========================= */
router.put(
  "/freeze/:userId",
  protect,
  adminOnly,
  adminController.toggleFreezeAccount
);

/* =========================
   FLAGGED TRANSACTIONS
========================= */
router.get(
  "/flagged-transactions",
  protect,
  adminOnly,
  adminController.getFlaggedTransactions
);

/* =========================
   AUDIT LOGS
========================= */
router.get(
  "/audit-logs",
  protect,
  adminOnly,
  adminController.getAuditLogs
);

/* =========================
   LOGIN SESSIONS
========================= */
router.get(
  "/login-sessions",
  protect,
  adminOnly,
  adminController.getLoginSessions
);

/* =========================
   RISK TRANSACTIONS
========================= */
router.get(
  "/risk-transactions",
  protect,
  adminOnly,
  adminController.getRiskTransactions
);

module.exports = router;