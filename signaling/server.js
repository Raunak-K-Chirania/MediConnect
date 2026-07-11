require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("FATAL CONFIGURATION ERROR: JWT_SECRET environment variable is required in production mode.");
  }
}

const app = express();
const PORT = process.env.PORT || 5001;

// 1. HTTP Security Headers
app.use(helmet());

// 2. CORS Policy Hardening
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",")
  : ["http://localhost:5173", "http://127.0.0.1:5173"];

const isOriginAllowed = (origin) => {
  if (!origin) return true;
  if (allowedOrigins.includes(origin) || allowedOrigins.includes("*")) return true;
  if (/^http:\/\/localhost:\d+$/.test(origin)) return true;
  if (/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) return true;
  return false;
};

app.use(
  cors({
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Blocked by CORS policy"));
      }
    },
    methods: ["GET", "POST"],
  })
);

// 3. HTTP Rate Limiting
const signalingHttpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  message: { error: "Too many HTTP requests to signaling server. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(signalingHttpLimiter);
app.use(express.json());

// Serve static tester page from the public directory
app.use(express.static(path.join(__dirname, "public")));

const server = http.createServer(app);

// Configure Socket.io with CORS enabled for frontend clients
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Blocked by CORS policy"));
      }
    },
    methods: ["GET", "POST"],
  },
  pingInterval: 10000,      // Ping client every 10 seconds to detect dead connections fast
  pingTimeout: 5000,        // Wait 5 seconds for pong response before closing
  transports: ["websocket"] // Restrict to websocket only for optimized overhead and latency
});

// Keep track of active users in rooms: { roomId: { socketId: { userId, role } } }
const roomUsers = {};

io.on("connection", (socket) => {
  console.log(`[Signaling] Socket connected: ${socket.id}`);

  // 1. Join Room Event
  socket.on("join-room", ({ roomId, userId, role, token }) => {
    if (!roomId || !userId || !token) {
      socket.emit("error", { message: "Room ID, User ID, and room token are required." });
      return;
    }

    try {
      // Cryptographically verify the token
      const decoded = jwt.verify(token, JWT_SECRET || "fallback_secret");

      // Verify that the token claims match the client parameters
      if (decoded.roomId !== roomId) {
        socket.emit("error", { message: "Access denied: Room ID mismatch." });
        return;
      }
      if (decoded.userId !== userId) {
        socket.emit("error", { message: "Access denied: User ID mismatch." });
        return;
      }
      if (decoded.role !== role) {
        socket.emit("error", { message: "Access denied: Role mismatch." });
        return;
      }

      // Restrict room access to Doctor, Patient, and Admin only
      if (decoded.role !== "Doctor" && decoded.role !== "Patient" && decoded.role !== "Admin") {
        socket.emit("error", { message: "Access denied: Unauthorized role for consultation rooms." });
        return;
      }
    } catch (err) {
      console.error(`[Signaling] Token verification failed for user ${userId} in room ${roomId}:`, err.message);
      socket.emit("error", { message: "Access denied: Invalid or expired room token." });
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

  // Helper to validate signal relays and prevent room/peer hijacking
  const validateRelay = (targetSocketId, targetRoomId) => {
    if (!socket.roomId) {
      socket.emit("error", { message: "Access denied. You must join a room first." });
      return false;
    }
    if (targetRoomId && socket.roomId !== targetRoomId) {
      socket.emit("error", { message: "Access denied. You are not a member of the target room." });
      return false;
    }
    if (targetSocketId) {
      const isTargetInSameRoom = roomUsers[socket.roomId] && roomUsers[socket.roomId][targetSocketId];
      if (!isTargetInSameRoom) {
        socket.emit("error", { message: "Access denied. Target peer is not in your room." });
        return false;
      }
    }
    return true;
  };

  // 3. WebRTC SDP Offer Relay
  socket.on("offer", ({ roomId, targetSocketId, offer }) => {
    if (!validateRelay(targetSocketId, roomId)) return;
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
    if (!validateRelay(targetSocketId, roomId)) return;
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
    if (!validateRelay(targetSocketId, roomId)) return;
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
    if (!validateRelay(targetSocketId, roomId)) return;
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
