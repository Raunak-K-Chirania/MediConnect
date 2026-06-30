require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 5001;

// Middlewares
app.use(cors());
app.use(express.json());

// Serve static tester page from the public directory
app.use(express.static(path.join(__dirname, "public")));

const server = http.createServer(app);

// Configure Socket.io with CORS enabled for frontend clients
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins for dev/testing
    methods: ["GET", "POST"],
  },
});

// Keep track of active users in rooms: { roomId: { socketId: { userId, role } } }
const roomUsers = {};

io.on("connection", (socket) => {
  console.log(`[Signaling] Socket connected: ${socket.id}`);

  // 1. Join Room Event
  socket.on("join-room", ({ roomId, userId, role }) => {
    if (!roomId || !userId) {
      socket.emit("error", { message: "Room ID and User ID are required." });
      return;
    }

    // Join the Socket.io room
    socket.join(roomId);
    
    // Store user session info on the socket itself for convenience
    socket.roomId = roomId;
    socket.userId = userId;
    socket.role = role || "unknown";

    // Track user in memory
    if (!roomUsers[roomId]) {
      roomUsers[roomId] = {};
    }
    roomUsers[roomId][socket.id] = { userId, role: socket.role };

    console.log(`[Signaling] User ${userId} (${socket.role}) joined room: ${roomId} (Socket: ${socket.id})`);

    // Notify other clients in the room
    socket.to(roomId).emit("user-joined", {
      socketId: socket.id,
      userId,
      role: socket.role,
    });

    // Send the list of current users in the room back to the joined user
    socket.emit("room-users", {
      roomId,
      users: Object.entries(roomUsers[roomId]).map(([id, info]) => ({
        socketId: id,
        userId: info.userId,
        role: info.role,
      })),
    });
  });

  // 2. Leave Room Event
  socket.on("leave-room", () => {
    const { roomId, userId } = socket;
    if (roomId) {
      console.log(`[Signaling] User ${userId} left room: ${roomId} (Socket: ${socket.id})`);
      socket.leave(roomId);
      
      // Clean up memory
      if (roomUsers[roomId]) {
        delete roomUsers[roomId][socket.id];
        if (Object.keys(roomUsers[roomId]).length === 0) {
          delete roomUsers[roomId];
        }
      }

      // Notify others
      socket.to(roomId).emit("user-left", {
        socketId: socket.id,
        userId,
      });

      // Clear properties on socket
      socket.roomId = null;
    }
  });

  // 3. WebRTC SDP Offer Relay
  socket.on("offer", ({ roomId, targetSocketId, offer }) => {
    console.log(`[Signaling] Offer from ${socket.id} to ${targetSocketId || "room " + roomId}`);
    if (targetSocketId) {
      io.to(targetSocketId).emit("offer", {
        senderSocketId: socket.id,
        offer,
      });
    } else if (roomId) {
      socket.to(roomId).emit("offer", {
        senderSocketId: socket.id,
        offer,
      });
    }
  });

  // 4. WebRTC SDP Answer Relay
  socket.on("answer", ({ roomId, targetSocketId, answer }) => {
    console.log(`[Signaling] Answer from ${socket.id} to ${targetSocketId || "room " + roomId}`);
    if (targetSocketId) {
      io.to(targetSocketId).emit("answer", {
        senderSocketId: socket.id,
        answer,
      });
    } else if (roomId) {
      socket.to(roomId).emit("answer", {
        senderSocketId: socket.id,
        answer,
      });
    }
  });

  // 5. WebRTC ICE Candidate Relay
  socket.on("ice-candidate", ({ roomId, targetSocketId, candidate }) => {
    console.log(`[Signaling] ICE Candidate from ${socket.id} to ${targetSocketId || "room " + roomId}`);
    if (targetSocketId) {
      io.to(targetSocketId).emit("ice-candidate", {
        senderSocketId: socket.id,
        candidate,
      });
    } else if (roomId) {
      socket.to(roomId).emit("ice-candidate", {
        senderSocketId: socket.id,
        candidate,
      });
    }
  });

  // 5.5. Peer Media State Relay (Mute/Camera control)
  socket.on("peer-state", ({ roomId, targetSocketId, audioEnabled, videoEnabled }) => {
    console.log(`[Signaling] Peer state update from ${socket.id}: audioEnabled=${audioEnabled}, videoEnabled=${videoEnabled}`);
    if (targetSocketId) {
      io.to(targetSocketId).emit("peer-state", {
        senderSocketId: socket.id,
        audioEnabled,
        videoEnabled,
      });
    } else if (roomId) {
      socket.to(roomId).emit("peer-state", {
        senderSocketId: socket.id,
        audioEnabled,
        videoEnabled,
      });
    }
  });

  // 6. Handle Disconnection
  socket.on("disconnecting", () => {
    // Notify all rooms the socket was in
    for (const room of socket.rooms) {
      if (room !== socket.id) {
        socket.to(room).emit("user-left", {
          socketId: socket.id,
          userId: socket.userId,
        });

        if (roomUsers[room]) {
          delete roomUsers[room][socket.id];
          if (Object.keys(roomUsers[room]).length === 0) {
            delete roomUsers[room];
          }
        }
      }
    }
  });

  socket.on("disconnect", () => {
    console.log(`[Signaling] Socket disconnected: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`[Signaling] Signaling server running on port ${PORT}`);
});
