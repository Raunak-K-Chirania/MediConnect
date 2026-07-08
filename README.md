# MediConnect Healthcare Platform

MediConnect is a comprehensive telehealth and electronic health record (EHR) platform. It provides a secure Patient/Doctor portal, appointment scheduling, P2P encrypted video consultations, HIPAA-compliant clinical SOAP notes, and PHI audit logging.

## Workspace Architecture

The repository is structured as a monorepo containing three core components:

1. **`client/`**: React single page application built with Vite, TypeScript, and Tailwind CSS.
2. **`server/`**: Express REST API server backed by MongoDB. Handles authentication, scheduling, EHR records, database encryption, and audit logs.
3. **`signaling/`**: Node.js and Socket.io WebRTC signaling server. Relays secure WebRTC SDP handshakes and ICE candidates.

---

## Technical Features & WebRTC Optimizations

### 🔒 Cryptographically Enforced Telehealth Rooms
MediConnect consultation rooms are isolated using JWT tokens signed by the API server.
- Tokens enforce role authorization (Doctor, Patient, or Admin) and room ID bounds.
- Room tokens have strict timing validity: access is allowed only starting **10 minutes before** and ending **30 minutes after** the scheduled appointment slot.

### ⚡ Optimized WebRTC Peer Connections
- **Bandwidth Constraints**: Enforces video bitrate limits (capped at **1.0 Mbps** per client) to ensure visual stability and low latency on bad or mobile networks.
- **Audio Prioritization**: WebRTC audio tracks are configured with high network priority so that patient-doctor dialogue remains uninterrupted even if network quality degrades.
- **ICE Candidate Queue**: Resolves connection race conditions by buffering early-arrival ICE candidates until the peer set remote description completes, preventing connection establishment failures.

### 🌐 Scalable Socket.io Signaling
- **WebSocket Only**: Polling fallbacks are disabled to eliminate HTTP handshake overhead and minimize connection setup latency.
- **Aggressive Heartbeats**: The signaling server uses a `10s` ping interval and `5s` timeout to detect disconnected clients within **15 seconds** (enabling near-instant re-connection or peer disconnect states).
- **CORS Protection**: Origin checks are configuration-driven (`CORS_ORIGIN`) to prevent unauthorized cross-origin connections in production.

---

## Getting Started

### Prerequisites
- **Node.js** (v18 or higher)
- **npm** (v9 or higher)
- **MongoDB** (Running locally on `mongodb://localhost:27017/mediconnect` or set via variables)

### Step-by-Step Local Run Guide

To start the full stack, run each service in a separate terminal:

#### 1. Start the MongoDB Service
Make sure MongoDB is running on your machine.

#### 2. Start the API Server
```bash
cd server
npm install
# Configure server/.env file (see server/.env.example)
npm run dev
```
*API server runs on [http://localhost:5000](http://localhost:5000).*

#### 3. Start the Signaling Server
```bash
cd signaling
npm install
# Configure signaling/.env file (see signaling/.env.example)
npm run dev
```
*Signaling server runs on [http://localhost:5001](http://localhost:5001).*

#### 4. Start the Frontend Client
```bash
cd client
npm install
# Configure client/.env file (see client/README.md)
npm run dev
```
*Vite web client runs on [http://localhost:5173](http://localhost:5173).*

---

## Running the Automated Test Suites

We have built automated integration test suites located in `server/src/`. To run them:

1. Ensure your local MongoDB is running.
2. Navigate to the `server/` directory.
3. Run the security suite (validates room access tokens and time buffers):
   ```bash
   node src/test-telehealth-security.js
   ```
4. Run the simultaneous consultations suite (validates concurrent room isolation and signaling routing):
   ```bash
   node src/test-simultaneous-consultations.js
   ```

---

## Deployment Best Practices

### Signaling Server Deployment
1. Set `NODE_ENV=production`.
2. Configure `PORT` to bind to your server's listening port (e.g., `443` for secure websockets, or behind a reverse proxy like Nginx).
3. Update `JWT_SECRET` to match the secret of your Express backend.
4. Restrict `CORS_ORIGIN` to your official frontend domain (e.g. `CORS_ORIGIN=https://telehealth.mediconnect.com`).
5. Terminate SSL at Nginx/Load Balancer to enable secure WebSocket connections (`wss://`).

### API Server Deployment
1. Securely provision database variables (`MONGO_URI`), session token keys (`JWT_SECRET`), and HIPAA record encryption keys (`ENCRYPTION_KEY`).
2. Run database migrations and seed script.

### Frontend Deployment
1. Run `npm run build` to generate static assets.
2. Serve the static assets under `dist/` using a web server or CDN (e.g., Nginx, Netlify, Vercel, or AWS S3).
3. Ensure client environment variables (`VITE_API_URL` and `VITE_SIGNALING_URL`) are injected pointing to production server instances.
