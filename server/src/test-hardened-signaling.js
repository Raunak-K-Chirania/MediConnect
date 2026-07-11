const { spawn } = require("child_process");
const io = require("socket.io-client");
const jwt = require("jsonwebtoken");

const PORT = 6002;
const SIGNALING_URL = `http://localhost:${PORT}`;
const JWT_SECRET = "test_signaling_secret_key_12345";

// Helper to generate a room token
const generateRoomToken = (roomId, userId, role) => {
  return jwt.sign({ roomId, userId, role }, JWT_SECRET, { expiresIn: "5m" });
};

const runSignalingTests = async () => {
  console.log("================================================================================");
  console.log("🔒 STARTING INTEGRATION TEST SUITE: SIGNALING SERVER PEER RELAY CONTROLS");
  console.log("================================================================================\n");

  let signalingProcess = null;

  try {
    // 1. Spawn the Signaling Server on test port 6002
    console.log(`Starting signaling server process on port ${PORT}...`);
    signalingProcess = await new Promise((resolve, reject) => {
      const proc = spawn("node", ["../signaling/server.js"], {
        env: {
          ...process.env,
          PORT: String(PORT),
          JWT_SECRET: JWT_SECRET,
          NODE_ENV: "test"
        },
      });

      let hasStarted = false;

      proc.stdout.on("data", (data) => {
        const text = data.toString();
        if (text.includes("Signaling server running on port") || text.includes(`port ${PORT}`)) {
          if (!hasStarted) {
            hasStarted = true;
            console.log(`✔ Signaling server spawned and listening on port ${PORT}.`);
            setTimeout(() => resolve(proc), 1000);
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

    // Helper to create a connected socket client
    const createClient = () => {
      return new Promise((resolve, reject) => {
        const socket = io(SIGNALING_URL, {
          transports: ["websocket"],
          forceNew: true,
        });
        socket.on("connect", () => resolve(socket));
        socket.on("connect_error", (err) => reject(err));
      });
    };

    // 2. Test Area 1: Relays without joining room should fail
    console.log("\n--- [Test Area 1] Verify Relay Restriction Without Room Membership ---");
    const clientA = await createClient();
    console.log(`✔ Connected Client A (Socket: ${clientA.id})`);

    const relayPromise1 = new Promise((resolve) => {
      clientA.on("error", (err) => {
        console.log(`[CHECK] Client A error event received: "${err.message}" (Expected: Access denied. You must join a room first.)`);
        resolve(err.message.includes("You must join a room first"));
      });
    });

    clientA.emit("offer", { roomId: "room-1", offer: { sdp: "mock-sdp" } });
    const test1Passed = await relayPromise1;
    if (!test1Passed) throw new Error("Test 1 Failed: relay allowed without joining room!");
    console.log("✔ Restriction verified successfully.");

    // 3. Test Area 2: Joining different rooms, try to relay across rooms
    console.log("\n--- [Test Area 2] Verify Relay Restriction Across Different Rooms ---");
    const clientB = await createClient();
    console.log(`✔ Connected Client B (Socket: ${clientB.id})`);

    const tokenA = generateRoomToken("room-1", "user-a", "Doctor");
    const tokenB = generateRoomToken("room-2", "user-b", "Patient");

    // Join rooms
    await new Promise((resolve) => {
      clientA.on("room-users", () => resolve());
      clientA.emit("join-room", { roomId: "room-1", userId: "user-a", role: "Doctor", token: tokenA });
    });
    console.log("✔ Client A joined room-1");

    await new Promise((resolve) => {
      clientB.on("room-users", () => resolve());
      clientB.emit("join-room", { roomId: "room-2", userId: "user-b", role: "Patient", token: tokenB });
    });
    console.log("✔ Client B joined room-2");

    // Clear old error handlers and set up checks
    clientA.off("error");
    clientB.off("error");

    const relayPromise2 = new Promise((resolve) => {
      clientA.on("error", (err) => {
        console.log(`[CHECK] Client A error event received: "${err.message}" (Expected: Access denied. You are not a member of the target room.)`);
        resolve(err.message.includes("not a member of the target room"));
      });
    });

    clientA.emit("offer", { roomId: "room-2", offer: { sdp: "mock-sdp" } });
    const test2Passed = await relayPromise2;
    if (!test2Passed) throw new Error("Test 2 Failed: allowed relay to different room!");
    console.log("✔ Cross-room restriction verified successfully.");

    // 4. Test Area 3: Target transmission to client in different room
    console.log("\n--- [Test Area 3] Verify Targeted Peer Relay Restriction Across Rooms ---");
    const relayPromise3 = new Promise((resolve) => {
      clientA.off("error");
      clientA.on("error", (err) => {
        console.log(`[CHECK] Client A error received: "${err.message}" (Expected: Access denied. Target peer is not in your room.)`);
        resolve(err.message.includes("Target peer is not in your room"));
      });
    });

    clientA.emit("offer", { targetSocketId: clientB.id, offer: { sdp: "mock-sdp" } });
    const test3Passed = await relayPromise3;
    if (!test3Passed) throw new Error("Test 3 Failed: allowed targeted relay to peer in different room!");
    console.log("✔ Peer-room isolation verified successfully.");

    // 5. Test Area 4: Authorized relay in same room succeeds
    console.log("\n--- [Test Area 4] Verify Authorized Relay in Same Room ---");
    // Client B leaves room-2 and joins room-1
    clientB.emit("leave-room");
    const tokenB1 = generateRoomToken("room-1", "user-b", "Patient");
    
    await new Promise((resolve) => {
      clientB.off("room-users");
      clientB.on("room-users", () => resolve());
      clientB.emit("join-room", { roomId: "room-1", userId: "user-b", role: "Patient", token: tokenB1 });
    });
    console.log("✔ Client B switched to room-1");

    clientA.off("error");
    clientB.off("error");

    const relayPromise4 = new Promise((resolve) => {
      clientB.on("offer", ({ senderSocketId, offer }) => {
        console.log(`[CHECK] Client B received offer from ${senderSocketId} (SDP: "${offer.sdp}")`);
        resolve(offer.sdp === "authorized-sdp");
      });
    });

    clientA.emit("offer", { roomId: "room-1", targetSocketId: clientB.id, offer: { sdp: "authorized-sdp" } });
    const test4Passed = await relayPromise4;
    if (!test4Passed) throw new Error("Test 4 Failed: authorized relay did not succeed!");
    console.log("✔ Authorized relay succeeded successfully.");

    // Clean up connections
    clientA.disconnect();
    clientB.disconnect();

    console.log("\n================================================================================");
    console.log("🎉 ALL SIGNALING SERVER SECURITY AND RELAY CONTROL TESTS PASSED!");
    console.log("================================================================================\n");

  } catch (err) {
    console.error("\n❌ TESTS FAILED:", err.message);
    process.exitCode = 1;
  } finally {
    if (signalingProcess) {
      console.log("Stopping signaling server process...");
      signalingProcess.kill();
    }
  }
};

runSignalingTests();
