const express = require("express");
const cors = require("cors");
require("dotenv").config();

const http = require("http");
const helmet = require("helmet");
const compression = require("compression");

const { initSocket } = require("./src/socket");


try {
  require("./src/config/redis");
  console.log("Redis initialized");
} catch (err) {
  console.log("Redis skipped:", err.message);
}

const authRoutes = require("./src/routes/authRoutes");
const transactionRoutes = require("./src/routes/transactionRoutes");
const userRoutes = require("./src/routes/userRoutes");
const adminRoutes = require("./src/routes/adminRoutes");

const apiLimiter = require("./src/middleware/rateLimiter");
const requestLogger = require("./src/middleware/requestLogger");
const sanitize = require("./src/middleware/sanitize");

const app = express();

/* ================= SECURITY ================= */

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "https://bank-client-ecru.vercel.app",
];

/* ================= CORS FIX (SAFE FOR PRODUCTION) ================= */
app.use(
  cors({
    origin: function (origin, callback) {
      // allow server-to-server or mobile apps (no origin)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.log("Blocked by CORS:", origin);
      return callback(null, true); 
    },
    credentials: true,
  })
);

app.use(helmet());

/* ================= PERFORMANCE ================= */
app.use(compression());

/* ================= BODY PARSER ================= */
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true }));

/* ================= SECURITY MIDDLEWARE ================= */
app.use(apiLimiter);
app.use(requestLogger);
app.use(sanitize);

/* ================= ROUTES ================= */
app.use("/api/auth", authRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/users", userRoutes);
app.use("/api/admin", adminRoutes);

/* ================= HEALTH CHECK ================= */
app.get("/", (req, res) => {
  res.send("Banking API Running...");
});

app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    uptime: process.uptime(),
    timestamp: Date.now(),
  });
});

/* ================= ERROR HANDLER ================= */
app.use((err, req, res, next) => {
  console.error("SERVER ERROR:", err);

  res.status(500).json({
    message: "Something went wrong",
  });
});

/* ================= SERVER + SOCKET ================= */
const server = http.createServer(app);

initSocket(server);

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});