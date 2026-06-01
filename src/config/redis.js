const { createClient } = require("redis");

const redis = createClient({
  socket: {
    host: "127.0.0.1",
    port: 6379,
  },
});

redis.on("error", (err) => {
  console.log("Redis Error", err.message);
});

redis.connect();

module.exports = redis;