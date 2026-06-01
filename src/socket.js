const { Server } = require("socket.io");

let io = null;

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: "http://localhost:5173",
      methods: ["GET", "POST", "PUT", "DELETE"],
    },
  });

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    // join personal room using userId
    socket.on("joinRoom", (userId) => {
      if (!userId) return;

      socket.join(userId.toString());
      console.log(`User joined room: ${userId}`);
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
  });

  console.log("Socket initialized successfully");
};

const getIO = () => {
  if (!io) {
    throw new Error(
      "Socket.io not initialized. Did you call initSocket(server)?"
    );
  }

  return io;
};

module.exports = {
  initSocket,
  getIO,
};