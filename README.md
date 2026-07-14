# MediConnect Healthcare Platform

MediConnect is a comprehensive telehealth and electronic health record (EHR) platform. It provides a secure Patient/Doctor portal, appointment scheduling, P2P encrypted video consultations, HIPAA-compliant clinical SOAP notes, and PHI audit logging.

---

## 1. Workspace Architecture

The repository is structured as a monorepo containing three core components:

1. **`client/`**: React single page application built with Vite, TypeScript, and Tailwind CSS. Served via Nginx in production.
2. **`server/`**: Express REST API server backed by MongoDB. Handles authentication, scheduling, EHR records, database encryption, and audit logs.
3. **`signaling/`**: Node.js and Socket.io WebRTC signaling server. Relays secure WebRTC SDP handshakes and ICE candidates.

---

## 2. Cryptographic Architecture & Algorithms

To satisfy HIPAA and general healthcare privacy regulations, MediConnect implements cryptographically-enforced privacy at rest, in transit, and during session execution:

### 🔒 PHI Database Encryption-At-Rest (`aes-256-gcm`)
All sensitive Protected Health Information (PHI) in MongoDB collections is automatically encrypted before database writes:
- **Algorithm**: AES (Advanced Encryption Standard) in **GCM** (Galois/Counter Mode) with 256-bit keys.
- **Initialization Vector (IV)**: A cryptographically secure random 12-byte IV is generated per-field write to prevent pattern matching.
- **Data Integrity**: GCM mode generates a 16-byte authentication tag to verify data integrity and prevent unauthorized tampering.
- **Key Derivation**: The raw configured `ENCRYPTION_KEY` is derived into a secure 32-byte key via **SHA-256** hashing.
- **Storage Format**: Stored as a concatenated hex string `ivHex:tagHex:cipherHex`. Mongoose hooks automatically encrypt on save/update and decrypt on read.
- **Encrypted Fields**:
  - `Patient`: Phone, Address, Date of Birth, Emergency Contact, Allergies, Medical History.
  - `MedicalRecord`: Diagnosis, Symptoms, Treatment Plan, Medications, Allergies, Notes.
  - `Prescription`: Medication names, Dosages, Frequencies, Durations, and Instructions.

### 🔑 Session and Token Authentication (`JWT` & `bcryptjs`)
- **Password Hashing**: User credentials are encrypted using **bcryptjs** with a high salt round value before persistence.
- **Stateless Sessions**: Client auth uses JSON Web Tokens (JWT) signed with `JWT_SECRET` (HMAC-SHA256).
- **WebRTC Consultation Rooms Security**: Consultation room access is restricted using JWT tokens signed by the API server. Tokens are bounded to specific appointment slot windows (valid only **10 minutes before** and **30 minutes after** the appointment times).

### 📹 Peer-to-Peer Media Security (`DTLS` / `SRTP`)
- WebRTC consultation audio and video streams travel directly between peer browsers, encrypted using **DTLS** (Datagram Transport Layer Security) and **SRTP** (Secure Real-time Transport Protocol).

---

## 3. Environment Variables

### Frontend Client (`client/`)
Create a `.env` or inject these variables during build time:
| Variable | Description | Default Value |
| :--- | :--- | :--- |
| `VITE_API_URL` | Base URL of the Express API backend | `http://localhost:5000/api` |
| `VITE_SIGNALING_URL` | Socket.io URL of the signaling server | `http://localhost:5001` |

### Backend API Server (`server/`)
Create a `server/.env` file:
| Variable | Description | Default Value |
| :--- | :--- | :--- |
| `PORT` | Listening port for the API server | `5000` |
| `MONGO_URI` | MongoDB Connection URL | `mongodb://localhost:27017/mediconnect` |
| `NODE_ENV` | Mode execution environment | `development` |
| `JWT_SECRET` | Secret key for signing session & room tokens | `my_super_secret_key_123_mediconnect` |
| `ENCRYPTION_KEY` | Hex or alphanumeric key (min 32 chars) for GCM | `my_secure_encryption_key_32_chars_1234` |
| `ADMIN_EMAIL` | Initial admin user email (for seeding) | `admin@mediconnect.com` |
| `ADMIN_PASSWORD` | Initial admin user password (for seeding) | `Password123!` |

### Signaling Server (`signaling/`)
Create a `signaling/.env` file:
| Variable | Description | Default Value |
| :--- | :--- | :--- |
| `PORT` | Listening port for the signaling server | `5001` |
| `NODE_ENV` | Mode execution environment | `development` |
| `JWT_SECRET` | Secret key (must match backend `JWT_SECRET`) | `my_super_secret_key_123_mediconnect` |
| `CORS_ORIGIN` | Allowed Client Origins (comma-separated or `*`) | `http://localhost:5173,http://127.0.0.1:5173` |

---

## 4. Local Setup & Installation

### Prerequisites
- **Node.js** (v18 or higher)
- **npm** (v9 or higher)
- **MongoDB** (Running locally on default port `27017` or configured via `MONGO_URI`)

### Step-by-Step Local Run Guide
To run the full stack manually outside of containers, open three separate terminals:

#### 1. Start MongoDB
Ensure that your local MongoDB server is running:
```bash
# Example for Windows Service
net start MongoDB
```

#### 2. Start the API Server
```bash
cd server
npm install
# Setup .env file
npm run dev
```
*API runs on `http://localhost:5000`.*

#### 3. Start the Signaling Server
```bash
cd signaling
npm install
# Setup .env file
npm run dev
```
*Signaling runs on `http://localhost:5001`.*

#### 4. Start the Frontend Client
```bash
cd client
npm install
# Setup .env file
npm run dev
```
*Frontend runs on `http://localhost:5173`.*

---

## 5. Dockerization & Commands

MediConnect includes production-optimized Docker configurations for high performance, ease of installation, and network security.

### Docker Commands

#### Run the Entire Stack
Build and launch all services (MongoDB, backend, signaling, frontend) in the background:
```bash
docker compose up --build -d
```
*Once up, access the frontend at `http://localhost:8080`.*

#### Check Service Status
```bash
docker compose ps
```

#### View Application Logs
```bash
# All logs
docker compose logs -f

# Specific container logs
docker compose logs -f backend
docker compose logs -f frontend
```

#### Seed Database Manually (Inside container)
If you need to seed/reseed the admin user manually inside the running backend container:
```bash
docker compose exec backend node src/create-admin.js
```

#### Stop and Clean up Containers
Stop containers and clean up the shared bridge networks:
```bash
docker compose down
```

#### Remove Containers and Volumes
Teardown all containers, network configurations, and the persistent MongoDB volume:
```bash
docker compose down -v
```

---

## 6. Cloud Deployment Instructions

Follow these instructions to deploy the containerized MediConnect application to a cloud infrastructure (such as AWS, Google Cloud, or Render).

### Phase 1: Build & Push Images
Build the Docker images for production (replacing `myregistry` with your AWS ECR, GCP GCR, or Docker Hub username) and push them to a container registry:
```bash
# Build with production variables
docker build -t myregistry/mediconnect-backend:latest ./server
docker build -t myregistry/mediconnect-signaling:latest ./signaling
docker build --build-arg VITE_API_URL=https://api.mediconnect.com/api --build-arg VITE_SIGNALING_URL=https://signaling.mediconnect.com -t myregistry/mediconnect-frontend:latest ./client

# Push to registry
docker push myregistry/mediconnect-backend:latest
docker push myregistry/mediconnect-signaling:latest
docker push myregistry/mediconnect-frontend:latest
```

### Phase 2: Secure Database Hosting
Do **not** run MongoDB inside a standalone Docker container in production. Instead, utilize a fully managed database service like **MongoDB Atlas**:
1. Provision a MongoDB Atlas cluster (M10/M20 for HIPAA compliance, ensuring Business Associate Agreements (BAA) are signed).
2. Configure network access/IP whitelisting to only allow incoming traffic from your backend VPC/service IPs.
3. Replace the `MONGO_URI` in the backend service variables with the Atlas Connection String.

### Phase 3: Deploying Services (e.g. AWS ECS / Fargate or Render)
For a HIPAA-compliant cluster on AWS:
1. **Networking**: Create a custom VPC with public and private subnets. Place the `backend` and `signaling` tasks in the private subnets.
2. **Reverse Proxy / Load Balancer**: Set up an AWS Application Load Balancer (ALB) whitelisted with SSL certificate terminated at the load balancer level (`HTTPS` port 443).
3. **Routing Rules**:
   - Route `https://api.mediconnect.com/*` to the `backend` service (port 5000).
   - Route `https://signaling.mediconnect.com/*` to the `signaling` service (port 5001). Configure WebSocket support on this target group (sticky sessions enabled, HTTP/1.1 support).
   - Host static files directly or route `https://mediconnect.com` to the frontend static container or AWS S3+CloudFront.
4. **Environment Secrets**: Use AWS Secrets Manager or Parameter Store to inject production credentials (`JWT_SECRET`, `ENCRYPTION_KEY`, and `MONGO_URI`) securely into ECS Task Definitions.

---

## 7. API Documentation

All API request and response bodies use JSON. Authentication is performed via `Authorization: Bearer <JWT_Token>` headers on protected routes.

### Auth Endpoints (`/api/auth`)

#### 1. Register User
- **Method**: `POST`
- **Path**: `/api/auth/register`
- **Body**:
  ```json
  {
    "name": "John Doe",
    "email": "patient_doe@example.com",
    "password": "Password123!",
    "role": "Patient",
    "phone": "+15550001111",
    "address": "123 Health Ave",
    "dateOfBirth": "1990-01-01",
    "emergencyContact": "+19990001111",
    "allergies": [],
    "medicalHistory": []
  }
  ```
- **Response** (Status 201):
  ```json
  {
    "success": true,
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": { "id": "6a564afc3f1ae57e...", "role": "Patient", "email": "patient_doe@example.com" }
  }
  ```

#### 2. Login User
- **Method**: `POST`
- **Path**: `/api/auth/login`
- **Body**:
  ```json
  {
    "email": "patient_doe@example.com",
    "password": "Password123!"
  }
  ```
- **Response** (Status 200):
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": { "id": "6a564afc3f...", "name": "John Doe", "email": "patient_doe@example.com", "role": "Patient" }
  }
  ```

#### 3. Retrieve Own User
- **Method**: `GET`
- **Path**: `/api/auth/me`
- **Headers**: `Authorization: Bearer <Token>`
- **Response** (Status 200):
  ```json
  {
    "_id": "6a564afc3f...",
    "name": "John Doe",
    "email": "patient_doe@example.com",
    "role": "Patient"
  }
  ```

---

### Doctor Availability Endpoints

#### 1. Configure Doctor Availability
- **Method**: `POST`
- **Path**: `/api/doctor-availability`
- **Headers**: `Authorization: Bearer <Doctor_Token>`
- **Body**:
  ```json
  {
    "doctorId": "6a564afb3f1ae57ef32754e0",
    "workingDays": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    "startHour": "09:00",
    "endHour": "17:00",
    "slotDuration": 30,
    "breakSlots": [
      { "start": "12:00", "end": "13:00" }
    ]
  }
  ```
- **Response** (Status 200):
  ```json
  { "success": true, "message": "Availability configured successfully" }
  ```

#### 2. Retrieve Available Slots
- **Method**: `GET`
- **Path**: `/api/appointments/available-slots/:doctorId?date=YYYY-MM-DD`
- **Response** (Status 200):
  ```json
  {
    "success": true,
    "slots": ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30"]
  }
  ```

---

### Appointment Endpoints (`/api/appointments`)

#### 1. Book Appointment
- **Method**: `POST`
- **Path**: `/api/appointments`
- **Headers**: `Authorization: Bearer <Patient_Token>`
- **Body**:
  ```json
  {
    "patientId": "6a564afc3f1ae57ef32754e3",
    "doctorId": "6a564afb3f1ae57ef32754e0",
    "appointmentDate": "2026-07-20",
    "startTime": "09:00",
    "endTime": "09:30",
    "appointmentType": "Routine Consultation",
    "reasonForVisit": "Annual checkup."
  }
  ```
- **Response** (Status 201):
  ```json
  {
    "success": true,
    "data": {
      "_id": "6a564afc3f1ae57ef32754ed",
      "patientId": "6a564afc3f1ae57ef32754e3",
      "doctorId": "6a564afb3f1ae57ef32754e0",
      "appointmentDate": "2026-07-20T00:00:00.000Z",
      "startTime": "09:00",
      "endTime": "09:30",
      "status": "Pending",
      "appointmentType": "Routine Consultation"
    }
  }
  ```

#### 2. Approve Appointment
- **Method**: `PATCH`
- **Path**: `/api/appointments/:id/approve`
- **Headers**: `Authorization: Bearer <Doctor_Token>`
- **Response** (Status 200):
  ```json
  { "success": true, "message": "Appointment approved" }
  ```

#### 3. Reject Appointment
- **Method**: `PATCH`
- **Path**: `/api/appointments/:id/reject`
- **Headers**: `Authorization: Bearer <Doctor_Token>`
- **Body**:
  ```json
  { "reason": "Conflict in schedule" }
  ```
- **Response** (Status 200):
  ```json
  { "success": true, "message": "Appointment rejected" }
  ```

#### 4. Cancel Appointment
- **Method**: `PATCH`
- **Path**: `/api/appointments/:id/cancel`
- **Headers**: `Authorization: Bearer <User_Token>`
- **Body**:
  ```json
  { "reason": "Patient requested cancellation" }
  ```
- **Response** (Status 200):
  ```json
  { "success": true, "message": "Appointment cancelled" }
  ```

#### 5. Request Telehealth Consultation Meeting Token
- **Method**: `GET`
- **Path**: `/api/appointments/:id/meeting-token`
- **Headers**: `Authorization: Bearer <User_Token>`
- **Response** (Status 200):
  ```json
  {
    "success": true,
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "roomId": "6a564afc3f1ae57ef32754ed"
  }
  ```

---

### Medical Record and SOAP Note Endpoints (`/api/records`)

#### 1. Create Medical Record (SOAP Note & Prescription)
- **Method**: `POST`
- **Path**: `/api/records`
- **Headers**: `Authorization: Bearer <Doctor_Token>`
- **Body**:
  ```json
  {
    "patientId": "6a564afc3f1ae57ef32754e3",
    "diagnosis": "Mild seasonal influenza",
    "symptoms": ["fever", "cough"],
    "treatmentPlan": "Rest and hydration.",
    "medications": ["Ibuprofen"],
    "notes": "Patient advised rest for 3 days.",
    "prescriptions": [
      {
        "name": "Ibuprofen",
        "dosage": "400mg",
        "frequency": "Three times daily",
        "duration": "3 days",
        "instructions": "Take after meals."
      }
    ]
  }
  ```
- **Response** (Status 201):
  ```json
  {
    "success": true,
    "message": "Medical record created successfully",
    "recordId": "6a564b1915ee9479898c8137"
  }
  ```

#### 2. Retrieve Patient's Medical Records
- **Method**: `GET`
- **Path**: `/api/records/patient/:patientId`
- **Headers**: `Authorization: Bearer <Authorized_User_Token>`
- **Response** (Status 200):
  ```json
  [
    {
      "_id": "6a564b1915ee9479898c8137",
      "patient": "6a564afc3f1ae57ef32754e3",
      "doctor": "6a564afb3f1ae57ef32754e0",
      "diagnosis": "Mild seasonal influenza",
      "symptoms": ["fever", "cough"],
      "treatmentPlan": "Rest and hydration.",
      "medications": ["Ibuprofen"],
      "notes": "Patient advised rest for 3 days.",
      "createdAt": "2026-07-14T14:43:37.667Z"
    }
  ]
  ```

---

## 8. Running the Integration Test Suites
MediConnect is verified by running automated end-to-end integration tests locally:
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
5. Run the Mongoose encryption validation suite:
   ```bash
   node src/test-encryption.js
   ```
