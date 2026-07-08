# MediConnect Frontend Client

This is the React frontend client for the MediConnect healthcare platform, built using React, Vite, TypeScript, and Tailwind CSS.

## Features

- **Telehealth Module**: Secure P2P encrypted WebRTC consultations with live SOAP clinical notes, medical chart integrations, and prior history access.
- **Responsive Layout**: Premium CSS styling optimized for both desktop viewports and mobile devices.
- **Offline / Network Detection**: Automatic UI overlays for network dropouts and secure signaling reconnection attempts.

## Getting Started

### Prerequisites

Ensure you have **Node.js** (v18+) and **npm** installed.

### Installation

1. Navigate to the client directory:
   ```bash
   cd client
   ```
2. Install dependencies:
   ```bash
   npm install
   ```

### Environment Configuration

Create a `.env` file in the `client/` directory to customize connection endpoints:

```env
# URL for the Express API server
VITE_API_URL=http://localhost:5000/api

# URL for the WebRTC Socket.io signaling server
VITE_SIGNALING_URL=http://localhost:5001
```

*If no environment variables are defined, the app will fallback to the local development defaults listed above.*

### Running the Application

Start the local Vite development server:
```bash
npm run dev
```
The client dashboard will typically be available at [http://localhost:5173](http://localhost:5173).

### Building for Production

Compile and bundle the frontend code for production deployment:
```bash
npm run build
```
This optimizes and compiles assets into the `dist/` directory.
