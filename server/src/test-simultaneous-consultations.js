const { spawn } = require("child_process");
const path = require("path");
const io = require("socket.io-client");
const jwt = require("jsonwebtoken");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const SIGNALING_PORT = 5099;
const SIGNALING_URL = `http://localhost:${SIGNALING_PORT}`;
const JWT_SECRET = process.env.JWT_SECRET || "my_super_secret_key_123_mediconnect";

// Helper to generate a meeting token
const generateTestToken = (roomId, userId, role) => {
  return jwt.sign({ roomId, userId, role }, JWT_SECRET, { expiresIn: "10m" });
};

const runTests = async () => {
  console.log("================================================================================");
  console.log("🚀 STARTING TELEHEALTH MULTIPLE SIMULTANEOUS CONSULTATIONS TEST SUITE");
  console.log("================================================================================\n");

  let signalingProcess = null;

  try {
    // 1. Spawn the Signaling Server on testing port 5099
    console.log(`Starting signaling server on port ${SIGNALING_PORT}...`);
    signalingProcess = await new Promise((resolve, reject) => {
      const proc = spawn("node", ["server.js"], {
        cwd: path.join(__dirname, "../../signaling"),
        env: {
          ...process.env,
          PORT: String(SIGNALING_PORT),
          JWT_SECRET: JWT_SECRET,
          NODE_ENV: "test"
        }
      });

      let hasStarted = false;

      proc.stdout.on("data", (data) => {
        const text = data.toString();
        if (text.includes("Signaling server running") || text.includes(`port ${SIGNALING_PORT}`)) {
          if (!hasStarted) {
            hasStarted = true;
            console.log(`✔ Signaling server spawned and listening on port ${SIGNALING_PORT}.`);
            setTimeout(() => resolve(proc), 500);
          }
        }
      });

      proc.stderr.on("data", (data) => {
        console.error(`[Signaling Stderr] ${data.toString().trim()}`);
      });

      proc.on("error", (err) => {
        reject(err);
      });
    });

    // 2. Prepare test data for Room 1 and Room 2
    const room1 = "appointment-room-1";
    const room2 = "appointment-room-2";

    const doc1Info = { userId: "doc-1", role: "Doctor" };
    const pat1Info = { userId: "pat-1", role: "Patient" };
    
    const doc2Info = { userId: "doc-2", role: "Doctor" };
    const pat2Info = { userId: "pat-2", role: "Patient" };

    const tokenDoc1 = generateTestToken(room1, doc1Info.userId, doc1Info.role);
    const tokenPat1 = generateTestToken(room1, pat1Info.userId, pat1Info.role);
    
    const tokenDoc2 = generateTestToken(room2, doc2Info.userId, doc2Info.role);
    const tokenPat2 = generateTestToken(room2, pat2Info.userId, pat2Info.role);

    // 3. Connect clients
    console.log("\nConnecting Room 1 and Room 2 clients...");
    const clients = [];

    const connectClient = (roomId, userId, role, token) => {
      return new Promise((resolve, reject) => {
        const socket = io(SIGNALING_URL, {
          transports: ["websocket"],
          forceNew: true
        });

        socket.on("connect", () => {
          socket.emit("join-room", { roomId, userId, role, token });
        });

        socket.on("room-users", (data) => {
          resolve({ socket, data });
        });

        socket.on("error", (err) => {
          reject(new Error(`Socket Error for ${userId}: ${err.message}`));
        });

        // Set a timeout
        setTimeout(() => {
          socket.disconnect();
          reject(new Error(`Connection timeout for ${userId}`));
        }, 5000);
      });
    };

    const cDoc1 = await connectClient(room1, doc1Info.userId, doc1Info.role, tokenDoc1);
    console.log("✔ Room 1 - Doctor 1 connected. Socket ID:", cDoc1.socket.id);
    clients.push(cDoc1.socket);

    const cPat1 = await connectClient(room1, pat1Info.userId, pat1Info.role, tokenPat1);
    console.log("✔ Room 1 - Patient 1 connected. Socket ID:", cPat1.socket.id);
    clients.push(cPat1.socket);

    const cDoc2 = await connectClient(room2, doc2Info.userId, doc2Info.role, tokenDoc2);
    console.log("✔ Room 2 - Doctor 2 connected. Socket ID:", cDoc2.socket.id);
    clients.push(cDoc2.socket);

    const cPat2 = await connectClient(room2, pat2Info.userId, pat2Info.role, tokenPat2);
    console.log("✔ Room 2 - Patient 2 connected. Socket ID:", cPat2.socket.id);
    clients.push(cPat2.socket);

    // 4. Verify initial room counts
    console.log("\nVerifying room membership isolated states...");
    if (cDoc1.data.users.length !== 1 || cPat1.data.users.length !== 2) {
      throw new Error(`Room 1 counts incorrect: Doc1 saw ${cDoc1.data.users.length}, Pat1 saw ${cPat1.data.users.length}`);
    }
    if (cDoc2.data.users.length !== 1 || cPat2.data.users.length !== 2) {
      throw new Error(`Room 2 counts incorrect: Doc2 saw ${cDoc2.data.users.length}, Pat2 saw ${cPat2.data.users.length}`);
    }
    console.log("✔ Room isolation lists verified successfully.");

    // 5. Test SDP Offer Routing & Room Isolation
    console.log("\nTesting WebRTC SDP Offer Routing and Room Isolation...");
    const testOffer = { type: "offer", sdp: "dummy-sdp-data" };
    
    let doc1ReceivedOffer = false;
    let room2ReceivedOffer = false;

    cDoc1.socket.on("offer", ({ senderSocketId, offer }) => {
      if (senderSocketId === cPat1.socket.id && offer.sdp === testOffer.sdp) {
        doc1ReceivedOffer = true;
      }
    });

    const room2FailureHandler = () => {
      room2ReceivedOffer = true;
    };
    cDoc2.socket.on("offer", room2FailureHandler);
    cPat2.socket.on("offer", room2FailureHandler);

    // Send offer from Pat1 to Doc1
    cPat1.socket.emit("offer", {
      roomId: room1,
      targetSocketId: cDoc1.socket.id,
      offer: testOffer
    });

    // Wait for event relay
    await new Promise((r) => setTimeout(r, 1000));

    if (!doc1ReceivedOffer) {
      throw new Error("Doctor 1 in Room 1 did not receive the SDP offer from Patient 1");
    }
    if (room2ReceivedOffer) {
      throw new Error("Crosstalk detected: Clients in Room 2 received the SDP offer sent in Room 1!");
    }
    console.log("✔ Offer successfully routed. Room 2 completely isolated from Room 1 offer.");

    // Cleanup offer event listeners
    cDoc2.socket.off("offer", room2FailureHandler);
    cPat2.socket.off("offer", room2FailureHandler);

    // 6. Test SDP Answer Routing
    console.log("\nTesting WebRTC SDP Answer Routing...");
    const testAnswer = { type: "answer", sdp: "dummy-sdp-answer" };
    let pat1ReceivedAnswer = false;

    cPat1.socket.on("answer", ({ senderSocketId, answer }) => {
      if (senderSocketId === cDoc1.socket.id && answer.sdp === testAnswer.sdp) {
        pat1ReceivedAnswer = true;
      }
    });

    cDoc1.socket.emit("answer", {
      roomId: room1,
      targetSocketId: cPat1.socket.id,
      answer: testAnswer
    });

    await new Promise((r) => setTimeout(r, 500));
    if (!pat1ReceivedAnswer) {
      throw new Error("Patient 1 in Room 1 did not receive the SDP answer from Doctor 1");
    }
    console.log("✔ Answer successfully routed back to initiator.");

    // 7. Test ICE Candidate Relay
    console.log("\nTesting ICE Candidate Relay...");
    const testCandidate = { candidate: "candidate:123456", sdpMid: "0", sdpMLineIndex: 0 };
    let doc1ReceivedCandidate = false;

    cDoc1.socket.on("ice-candidate", ({ senderSocketId, candidate }) => {
      if (senderSocketId === cPat1.socket.id && candidate.candidate === testCandidate.candidate) {
        doc1ReceivedCandidate = true;
      }
    });

    cPat1.socket.emit("ice-candidate", {
      roomId: room1,
      targetSocketId: cDoc1.socket.id,
      candidate: testCandidate
    });

    await new Promise((r) => setTimeout(r, 500));
    if (!doc1ReceivedCandidate) {
      throw new Error("Doctor 1 did not receive the ICE candidate from Patient 1");
    }
    console.log("✔ ICE Candidate successfully relayed.");

    // 8. Test Peer Media State Syncing
    console.log("\nTesting Peer Media State (Mute/Camera) sync relay...");
    let doc1ReceivedState = null;
    cDoc1.socket.on("peer-state", (state) => {
      doc1ReceivedState = state;
    });

    cPat1.socket.emit("peer-state", {
      roomId: room1,
      targetSocketId: cDoc1.socket.id,
      audioEnabled: false,
      videoEnabled: true
    });

    await new Promise((r) => setTimeout(r, 500));
    if (!doc1ReceivedState || doc1ReceivedState.audioEnabled !== false || doc1ReceivedState.videoEnabled !== true) {
      throw new Error("Doctor 1 did not receive correct peer state sync from Patient 1");
    }
    console.log("✔ Peer Media State successfully synchronized.");

    // 9. Test Disconnection and Teardown Isolation
    console.log("\nTesting client leaving and teardown isolation...");
    let doc1ReceivedLeft = false;
    let room2ReceivedLeft = false;

    const pat1SocketId = cPat1.socket.id;

    cDoc1.socket.on("user-left", (data) => {
      console.log("Doctor 1 received user-left event payload:", data);
      if (data.socketId === pat1SocketId && data.userId === pat1Info.userId) {
        doc1ReceivedLeft = true;
      }
    });

    const room2LeftHandler = () => {
      room2ReceivedLeft = true;
    };
    cDoc2.socket.on("user-left", room2LeftHandler);
    cPat2.socket.on("user-left", room2LeftHandler);

    // Disconnect Patient 1
    console.log("Disconnecting Patient 1...");
    cPat1.socket.disconnect();

    await new Promise((r) => setTimeout(r, 500));

    if (!doc1ReceivedLeft) {
      throw new Error("Doctor 1 did not receive user-left event when Patient 1 disconnected");
    }
    if (room2ReceivedLeft) {
      throw new Error("Crosstalk detected: Clients in Room 2 received user-left event when Patient 1 in Room 1 disconnected!");
    }
    console.log("✔ Disconnection isolation verified. Room 2 is completely unaffected.");

    // Clean up connected sockets
    console.log("\nDisconnecting remaining test sockets...");
    clients.forEach((s) => {
      if (s.connected) s.disconnect();
    });

    console.log("\n========================================================");
    console.log("🎉 ALL TESTS PASSED: MULTIPLE SIMULTANEOUS CONSULTATIONS ARE FULLY ISOLATED!");
    console.log("========================================================\n");

  } catch (err) {
    console.error("\n❌ TEST FAILURE:", err.message);
    process.exitCode = 1;
  } finally {
    if (signalingProcess) {
      console.log("Stopping signaling server process...");
      signalingProcess.kill();
    }
  }
};

runTests();
