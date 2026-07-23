import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../store/authStore';
import { appointmentService, Appointment } from '../services/appointmentService';
import { patientService, PatientProfile } from '../services/patientService';
import { clinicalNoteService, ClinicalNote } from '../services/clinicalNoteService';
import { medicalRecordService, MedicalRecord } from '../services/medicalRecordService';
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  PhoneOff, 
  AlertCircle,
  User,
  Activity,
  Wifi,
  WifiOff,
  ServerCrash,
  Clipboard,
  History,
  Info,
  ChevronRight,
  ChevronLeft,
  Save,
  CheckCircle,
  Loader2,
  Calendar,
  Clock,
  Heart,
  FileText
} from 'lucide-react';

export const VideoCallPage: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // WebRTC & Connection states
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'disconnected' | 'failed' | 'reconnecting'>('idle');
  const [signalingStatus, setSignalingStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connecting');
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [peerInfo, setPeerInfo] = useState<{ userId: string; role: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [ping, setPing] = useState<number | null>(null);
  const [permissionTrouble, setPermissionTrouble] = useState(false);

  // Peer states synced via signaling
  const [remoteAudioEnabled, setRemoteAudioEnabled] = useState(true);
  const [remoteVideoEnabled, setRemoteVideoEnabled] = useState(true);

  // MediConnect specific clinical metadata states
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [patientProfile, setPatientProfile] = useState<PatientProfile | null>(null);
  const [medicalRecords, setMedicalRecords] = useState<MedicalRecord[]>([]);
  const [loadingMetadata, setLoadingMetadata] = useState(true);

  // SOAP Note Form States (for Doctors)
  const [existingNoteId, setExistingNoteId] = useState<string | null>(null);
  const [subjective, setSubjective] = useState('');
  const [objective, setObjective] = useState('');
  const [assessment, setAssessment] = useState('');
  const [plan, setPlan] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteSaveSuccess, setNoteSaveSuccess] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Sidebar visibility and tabs
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<'soap' | 'chart' | 'history'>('soap');

  // DOM Refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  
  // Connection Refs
  const socketRef = useRef<Socket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const targetSocketIdRef = useRef<string | null>(null);
  const isCallerRef = useRef<boolean>(false);
  const iceRestartTimerRef = useRef<any | null>(null);
  const iceCandidatesQueueRef = useRef<RTCIceCandidateInit[]>([]);
  const [lastSavedSoap, setLastSavedSoap] = useState({ subjective: '', objective: '', assessment: '', plan: '' });

  const SIGNALING_URL = import.meta.env.VITE_SIGNALING_URL || 'http://localhost:5001';

  // 1. Fetch Metadata (Appointment, Patient, Medical History, Existing SOAP Note)
  useEffect(() => {
    if (!roomId || !user) return;

    const fetchMetadata = async () => {
      setLoadingMetadata(true);
      try {
        const apptRes = await appointmentService.getById(roomId);
        if (apptRes.success && apptRes.data) {
          const appt = apptRes.data;
          setAppointment(appt);

          // Get Patient Profile ID (could be populated object or raw string ID)
          const pId = typeof appt.patientId === 'object' ? appt.patientId._id : appt.patientId;
          
          if (pId) {
            // Load Patient Profile (contains allergies, DOB, blood group)
            try {
              const patRes = await patientService.getById(pId);
              if (patRes.success && patRes.patient) {
                setPatientProfile(patRes.patient);
              }
            } catch (err) {
              console.warn('[Clinical Console] Failed to load patient profile details:', err);
            }

            // Load Clinical SOAP Note history for this patient to find if there's an existing note for this appointment
            try {
              const notesRes = await clinicalNoteService.getByPatient(pId);
              const existingNote = notesRes.find((n: any) => n.appointmentId === roomId);
              if (existingNote) {
                setExistingNoteId(existingNote._id);
                setSubjective(existingNote.subjectiveFindings || '');
                setObjective(existingNote.objectiveFindings || '');
                setAssessment(existingNote.assessment || '');
                setPlan(existingNote.plan || '');
                setLastSavedSoap({
                  subjective: existingNote.subjectiveFindings || '',
                  objective: existingNote.objectiveFindings || '',
                  assessment: existingNote.assessment || '',
                  plan: existingNote.plan || ''
                });
              }
            } catch (err) {
              console.warn('[Clinical Console] Failed to fetch clinical notes history:', err);
            }

            // Load past EHR records for Doctor reference
            if (user.role === 'Doctor') {
              try {
                const historyRes = await medicalRecordService.getByPatient(pId);
                setMedicalRecords(historyRes.data?.records || []);
              } catch (err) {
                console.warn('[Clinical Console] Failed to fetch medical records history:', err);
              }
            }
          }
        }
      } catch (err) {
        console.error('[Clinical Console] Error loading session metadata:', err);
      } finally {
        setLoadingMetadata(false);
      }
    };

    fetchMetadata();
  }, [roomId, user]);

  // 2. Initialize Media & signaling
  const initMediaAndSignaling = async () => {
    try {
      setPermissionTrouble(false);
      setErrorMessage(null);
      setConnectionStatus('connecting');

      // First validate appointment and acquire a cryptographically secure room token
      let token = '';
      try {
        const tokenRes = await appointmentService.getMeetingToken(roomId!);
        if (tokenRes.success && tokenRes.data && tokenRes.data.token) {
          token = tokenRes.data.token;
        } else {
          throw new Error('Could not acquire room token.');
        }
      } catch (tokenErr: any) {
        console.error('[WebRTC Client] Room token validation failed:', tokenErr);
        const errMsg = tokenErr?.response?.data?.error || 'Access denied: You are not authorized or the consultation room is closed.';
        setErrorMessage(errMsg);
        setConnectionStatus('failed');
        return;
      }

      // Request camera and microphone permissions
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user'
          },
          audio: true
        });
      } catch (mediaErr: any) {
        console.warn('[WebRTC Client] Full A/V acquisition failed. Attempting audio-only fallback...', mediaErr);
        
        let customError = 'Camera blocked or unavailable. Joining with audio only.';
        if (mediaErr.name === 'NotAllowedError' || mediaErr.name === 'PermissionDeniedError') {
          customError = 'Camera access was denied in browser. Joining with audio only.';
        } else if (mediaErr.name === 'NotReadableError' || mediaErr.name === 'TrackStartError') {
          customError = 'Camera is already in use by another program. Joining with audio only.';
        } else if (mediaErr.name === 'NotFoundError' || mediaErr.name === 'DevicesNotFoundError') {
          customError = 'No camera hardware found on this device. Joining with audio only.';
        }

        try {
          // Graceful fallback to audio-only if camera unavailable or denied
          stream = await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: true
          });
          setVideoEnabled(false);
          setErrorMessage(customError);
        } catch (audioErr: any) {
          console.error('[WebRTC Client] Both audio and video acquisition failed:', audioErr);
          
          let finalErrorMsg = 'Could not access microphone or camera. Please ensure permissions are granted in your browser settings.';
          if (audioErr.name === 'NotAllowedError' || audioErr.name === 'PermissionDeniedError') {
            finalErrorMsg = 'Microphone and camera permissions were denied. Please check your browser address bar and retry.';
          } else if (audioErr.name === 'NotReadableError' || audioErr.name === 'TrackStartError') {
            finalErrorMsg = 'Microphone and camera are currently in use by another application. Please close it and retry.';
          } else if (audioErr.name === 'NotFoundError' || audioErr.name === 'DevicesNotFoundError') {
            finalErrorMsg = 'No microphone or camera devices were found on this computer. Please connect hardware and retry.';
          }

          setErrorMessage(finalErrorMsg);
          setPermissionTrouble(true);
          setConnectionStatus('failed');
          return;
        }
      }

      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Initialize Signaling Socket
      const socket = io(SIGNALING_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 15000,
        forceNew: true
      });
      socketRef.current = socket;

      socket.on('connect', () => {
        console.log('[WebRTC Client] Socket connected:', socket.id);
        setSignalingStatus('connected');
        
        // If we are reconnecting after a drop, clear old peer connection
        if (pcRef.current) {
          console.log('[WebRTC Client] Signaling reconnected. Clearing old peer connection for fresh negotiation.');
          cleanPeerConnection();
        }

        socket.emit('join-room', {
          roomId,
          userId: user?.id,
          role: user?.role,
          token
        });

        // Broadcast initial stream settings
        socket.emit('peer-state', {
          roomId,
          audioEnabled: audioEnabled,
          videoEnabled: videoEnabled
        });
      });

      socket.on('room-users', async ({ users }) => {
        console.log('[WebRTC Client] Room users received:', users);
        const otherUser = users.find((u: any) => u.socketId !== socket.id);
        if (otherUser) {
          targetSocketIdRef.current = otherUser.socketId;
          setPeerInfo({ userId: otherUser.userId, role: otherUser.role });
          await initiateCall(otherUser.socketId);
        }
      });

      socket.on('user-joined', ({ socketId, userId, role }) => {
        console.log('[WebRTC Client] User joined:', userId, socketId);
        targetSocketIdRef.current = socketId;
        setPeerInfo({ userId, role });

        // Inform new user of our audio/video settings
        socket.emit('peer-state', {
          roomId,
          targetSocketId: socketId,
          audioEnabled,
          videoEnabled
        });
      });

      socket.on('offer', async ({ senderSocketId, offer }) => {
        console.log('[WebRTC Client] Offer received from:', senderSocketId);
        targetSocketIdRef.current = senderSocketId;
        await handleReceivedOffer(senderSocketId, offer);
      });

      socket.on('answer', async ({ senderSocketId, answer }) => {
        console.log('[WebRTC Client] Answer received from:', senderSocketId);
        if (pcRef.current) {
          try {
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
            setConnectionStatus('connected');
            await flushIceCandidates();
          } catch (err) {
            console.error('[WebRTC Client] Error setting remote description for answer:', err);
          }
        }
      });

      socket.on('ice-candidate', async ({ senderSocketId, candidate }) => {
        if (pcRef.current) {
          if (pcRef.current.remoteDescription && pcRef.current.remoteDescription.type) {
            try {
              await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (err) {
              console.error('[WebRTC Client] Error adding ice candidate:', err);
            }
          } else {
            console.log('[WebRTC Client] Remote description not set yet. Queueing ICE candidate.');
            iceCandidatesQueueRef.current.push(candidate);
          }
        }
      });

      // Synchronize media settings toggled by remote peer
      socket.on('peer-state', ({ audioEnabled, videoEnabled }) => {
        console.log('[WebRTC Client] Remote peer state received: audio =', audioEnabled, 'video =', videoEnabled);
        setRemoteAudioEnabled(audioEnabled);
        setRemoteVideoEnabled(videoEnabled);
      });

      socket.on('user-left', ({ socketId, userId }) => {
        console.log('[WebRTC Client] Peer left:', userId, socketId);
        if (targetSocketIdRef.current === socketId) {
          cleanPeerConnection();
          setConnectionStatus('disconnected');
          setPeerInfo(null);
          setRemoteAudioEnabled(true);
          setRemoteVideoEnabled(true);
        }
      });

      socket.on('error', ({ message }) => {
        console.error('[WebRTC Client] Signaling server error:', message);
        setErrorMessage(message);
        setConnectionStatus('failed');
        if (socket) {
          socket.disconnect();
        }
      });

      socket.on('disconnect', (reason) => {
        console.log('[WebRTC Client] Socket disconnected:', reason);
        setSignalingStatus('disconnected');
        if (reason !== 'io client disconnect') {
          setConnectionStatus('reconnecting');
        }
      });

      socket.on('connect_error', (error) => {
        console.error('[WebRTC Client] Socket connection error:', error);
        setSignalingStatus('connecting');
      });

      socket.on('reconnect_attempt', (attempt) => {
        console.log('[WebRTC Client] Attempting to reconnect signaling server. Attempt #:', attempt);
        setSignalingStatus('connecting');
      });

    } catch (err: any) {
      console.error('[WebRTC Client] Initialization failed:', err);
      setErrorMessage(
        'Could not access microphone or camera. Please ensure permissions are granted in your browser settings.'
      );
      setPermissionTrouble(true);
      setConnectionStatus('failed');
    }
  };

  useEffect(() => {
    if (!roomId || !user) {
      setErrorMessage('Invalid meeting room or user session.');
      return;
    }

    initMediaAndSignaling();

    return () => {
      cleanupAll();
    };
  }, [roomId, user]);

  // Monitor browser network connection (online/offline)
  useEffect(() => {
    const handleOnline = () => {
      console.log('[Network] Browser went online');
      setIsOffline(false);
      setErrorMessage(null);
      
      // If socket.io is disconnected, force it to try reconnecting
      if (socketRef.current && !socketRef.current.connected) {
        socketRef.current.connect();
      }
    };

    const handleOffline = () => {
      console.log('[Network] Browser went offline');
      setIsOffline(true);
      setErrorMessage('You are offline. Please check your internet connection.');
      
      // Force connection status to failed while offline
      setConnectionStatus('failed');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 3. WebRTC latency monitoring (P2P Ping)
  useEffect(() => {
    if (connectionStatus !== 'connected' || !pcRef.current) {
      setPing(null);
      return;
    }
    const interval = setInterval(async () => {
      if (!pcRef.current) return;
      try {
        const stats = await pcRef.current.getStats();
        stats.forEach((report) => {
          if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            if (report.currentRoundTripTime !== undefined) {
              setPing(Math.round(report.currentRoundTripTime * 1000));
            }
          }
        });
      } catch (e) {
        console.warn('[WebRTC Client] Stats fetch failed:', e);
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [connectionStatus]);

  // Optimize RTCRtpSender parameters (max bitrate & priority)
  const optimizeVideoSender = (pc: RTCPeerConnection) => {
    const senders = pc.getSenders();
    senders.forEach((sender) => {
      if (sender.track && sender.track.kind === 'video') {
        try {
          const parameters = sender.getParameters();
          if (!parameters.encodings) {
            parameters.encodings = [{}];
          }
          // Set maximum video encoding bitrate to 1 Mbps for light network load
          parameters.encodings[0].maxBitrate = 1000000;
          // Set network priority to medium for video
          parameters.encodings[0].networkPriority = 'medium';
          sender.setParameters(parameters).then(() => {
            console.log('[WebRTC Client] Successfully optimized video sender parameters');
          }).catch(err => {
            console.warn('[WebRTC Client] Failed to set video sender parameters:', err);
          });
        } catch (e) {
          console.warn('[WebRTC Client] Error getting/setting video sender parameters:', e);
        }
      } else if (sender.track && sender.track.kind === 'audio') {
        try {
          const parameters = sender.getParameters();
          if (!parameters.encodings) {
            parameters.encodings = [{}];
          }
          // Set high network priority for audio to prioritize voice packets over video
          parameters.encodings[0].networkPriority = 'high';
          sender.setParameters(parameters).catch(err => {
            console.warn('[WebRTC Client] Failed to set audio sender parameters:', err);
          });
        } catch (e) {
          console.warn('[WebRTC Client] Error setting audio sender parameters:', e);
        }
      }
    });
  };

  // Flush queued ICE candidates
  const flushIceCandidates = async () => {
    if (!pcRef.current) return;
    console.log(`[WebRTC Client] Flushing ${iceCandidatesQueueRef.current.length} queued ICE candidates`);
    while (iceCandidatesQueueRef.current.length > 0) {
      const candidate = iceCandidatesQueueRef.current.shift();
      if (candidate) {
        try {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error('[WebRTC Client] Error adding queued ice candidate:', err);
        }
      }
    }
  };

  // Initiate ICE restart sequence
  const initiateIceRestart = async () => {
    if (!pcRef.current || !targetSocketIdRef.current) {
      console.warn('[WebRTC Client] Cannot restart ICE: PeerConnection or Target Socket ID missing');
      return;
    }
    console.log('[WebRTC Client] Initiating ICE restart...');
    setConnectionStatus('reconnecting');
    try {
      const offer = await pcRef.current.createOffer({ iceRestart: true });
      await pcRef.current.setLocalDescription(offer);
      
      if (socketRef.current) {
        socketRef.current.emit('offer', {
          roomId,
          targetSocketId: targetSocketIdRef.current,
          offer
        });
      }
    } catch (err) {
      console.error('[WebRTC Client] ICE restart SDP creation failed. Attempting full connection recreation.', err);
      if (targetSocketIdRef.current) {
        await initiateCall(targetSocketIdRef.current);
      }
    }
  };

  // Create PeerConnection
  const createPeerConnection = (targetSocketId: string): RTCPeerConnection => {
    if (pcRef.current) {
      if (targetSocketIdRef.current !== targetSocketId) {
        console.log('[WebRTC Client] Target socket ID changed from', targetSocketIdRef.current, 'to', targetSocketId, '. Recreating PeerConnection.');
        cleanPeerConnection();
      } else {
        return pcRef.current;
      }
    }

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ]
    });

    // Add local tracks to WebRTC connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });
      // Set initial bitrate constraints and track priorities
      optimizeVideoSender(pc);
    }

    pc.ontrack = (event) => {
      console.log('[WebRTC Client] Remote track added:', event.streams[0]);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
      setConnectionStatus('connected');
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('ice-candidate', {
          roomId,
          targetSocketId,
          candidate: event.candidate
        });
      }
    };

    const handleStateChange = () => {
      if (!pc) return;
      const connState = pc.connectionState;
      const iceState = pc.iceConnectionState;
      console.log(`[WebRTC Client] connectionState: ${connState}, iceConnectionState: ${iceState}`);

      if (connState === 'connected' || iceState === 'connected') {
        setConnectionStatus('connected');
        if (iceRestartTimerRef.current) {
          clearTimeout(iceRestartTimerRef.current);
          iceRestartTimerRef.current = null;
        }
        setErrorMessage(null);
        // Optimize video sender parameters when connection state becomes connected
        optimizeVideoSender(pc);
      } else if (connState === 'disconnected' || iceState === 'disconnected') {
        setConnectionStatus('reconnecting');
        if (!iceRestartTimerRef.current) {
          iceRestartTimerRef.current = setTimeout(() => {
            if (pcRef.current && (pcRef.current.connectionState === 'disconnected' || pcRef.current.iceConnectionState === 'disconnected')) {
              console.log('[WebRTC Client] Connection remains disconnected. Triggering ICE restart.');
              if (isCallerRef.current) {
                initiateIceRestart();
              }
            }
            iceRestartTimerRef.current = null;
          }, 4000);
        }
      } else if (connState === 'failed' || iceState === 'failed') {
        setConnectionStatus('failed');
        if (isCallerRef.current) {
          initiateIceRestart();
        }
      } else if (connState === 'closed' || iceState === 'closed') {
        setConnectionStatus('disconnected');
      }
    };

    pc.onconnectionstatechange = handleStateChange;
    pc.oniceconnectionstatechange = handleStateChange;

    pcRef.current = pc;
    return pc;
  };

  const initiateCall = async (targetSocketId: string) => {
    console.log('[WebRTC Client] Initiating call to socket:', targetSocketId);
    isCallerRef.current = true;
    try {
      const pc = createPeerConnection(targetSocketId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      if (socketRef.current) {
        socketRef.current.emit('offer', {
          roomId,
          targetSocketId,
          offer
        });
      }
    } catch (err) {
      console.error('[WebRTC Client] Failed to initiate call offer:', err);
      setErrorMessage('Failed to initiate WebRTC call offer.');
    }
  };

  const handleReceivedOffer = async (senderSocketId: string, offer: RTCSessionDescriptionInit) => {
    console.log('[WebRTC Client] Handling offer from socket:', senderSocketId);
    isCallerRef.current = false;
    try {
      const pc = createPeerConnection(senderSocketId);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      await flushIceCandidates();

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      if (socketRef.current) {
        socketRef.current.emit('answer', {
          roomId,
          targetSocketId: senderSocketId,
          answer
        });
      }
      setConnectionStatus('connected');
    } catch (err) {
      console.error('[WebRTC Client] Failed to negotiate connection:', err);
      setErrorMessage('Failed to negotiate peer connection.');
    }
  };

  // Audio/Video control methods with signaling updates
  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        const newState = !audioTrack.enabled;
        audioTrack.enabled = newState;
        setAudioEnabled(newState);
        
        // Sync with remote peer
        if (socketRef.current) {
          socketRef.current.emit('peer-state', {
            roomId,
            targetSocketId: targetSocketIdRef.current,
            audioEnabled: newState,
            videoEnabled
          });
        }
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        const newState = !videoTrack.enabled;
        videoTrack.enabled = newState;
        setVideoEnabled(newState);
        
        // Sync with remote peer
        if (socketRef.current) {
          socketRef.current.emit('peer-state', {
            roomId,
            targetSocketId: targetSocketIdRef.current,
            audioEnabled,
            videoEnabled: newState
          });
        }
      } else {
        alert("No camera device was detected or camera access was blocked when joining the call.");
      }
    }
  };

  // Cleanup helper
  const cleanPeerConnection = () => {
    iceCandidatesQueueRef.current = [];
    if (iceRestartTimerRef.current) {
      clearTimeout(iceRestartTimerRef.current);
      iceRestartTimerRef.current = null;
    }
    if (pcRef.current) {
      console.log('[WebRTC Client] Cleaning up peer connection event handlers and closing connection');
      pcRef.current.onicecandidate = null;
      pcRef.current.ontrack = null;
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.oniceconnectionstatechange = null;
      pcRef.current.onsignalingstatechange = null;
      
      try {
        pcRef.current.getTransceivers().forEach((transceiver) => {
          if (transceiver.stop) transceiver.stop();
        });
      } catch (err) {
        console.warn('[WebRTC Client] Error stopping transceivers:', err);
      }
      
      pcRef.current.close();
      pcRef.current = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
  };

  const cleanupAll = () => {
    cleanPeerConnection();
    isCallerRef.current = false;
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (socketRef.current) {
      socketRef.current.emit('leave-room');
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  };

  const handleHangUp = () => {
    if (user?.role === 'Doctor') {
      const hasUnsavedSoap = 
        subjective !== lastSavedSoap.subjective ||
        objective !== lastSavedSoap.objective ||
        assessment !== lastSavedSoap.assessment ||
        plan !== lastSavedSoap.plan;
      if (hasUnsavedSoap) {
        const confirmHangUp = window.confirm(
          "You have unsaved changes in your SOAP clinical note. Leaving now will discard these changes. Are you sure you want to exit the consultation?"
        );
        if (!confirmHangUp) return;
      }
    }

    cleanupAll();
    const dashboardPath = user?.role === 'Doctor' ? '/doctor/dashboard' : '/patient/dashboard';
    navigate(dashboardPath);
  };

  // SOAP Clinical Note Save action (Doctors only)
  const saveClinicalSOAPNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appointment || !user || user.role !== 'Doctor') return;

    // Validate inputs locally matching clinicalNoteSchema
    if (!subjective.trim() || !objective.trim() || !assessment.trim() || !plan.trim()) {
      setValidationError('All SOAP clinical note fields are required.');
      return;
    }

    setValidationError(null);
    setNoteSaving(true);
    try {
      const pId = typeof appointment.patientId === 'object' ? appointment.patientId._id : appointment.patientId;
      
      const payload = {
        appointmentId: roomId as string,
        patientId: pId,
        doctorId: user.id,
        subjectiveFindings: subjective,
        objectiveFindings: objective,
        assessment: assessment,
        plan: plan,
        consultationDate: new Date().toISOString().split('T')[0]
      };

      if (existingNoteId) {
        await clinicalNoteService.update(existingNoteId, payload);
      } else {
        const note = await clinicalNoteService.create(payload);
        setExistingNoteId(note._id);
      }
      setLastSavedSoap({
        subjective,
        objective,
        assessment,
        plan
      });
      
      setNoteSaveSuccess(true);
      setTimeout(() => setNoteSaveSuccess(false), 3050);
    } catch (err: any) {
      console.error('[SOAP Notes] Failed to submit clinical findings:', err);
      setValidationError(err?.response?.data?.error || 'Failed to submit clinical note. Try again.');
    } finally {
      setNoteSaving(false);
    }
  };

  // Complete Appointment helper (Doctors only)
  const handleCompleteAppointment = async () => {
    if (!roomId) return;
    try {
      await appointmentService.complete(roomId);
      handleHangUp();
    } catch (err) {
      console.error('[SOAP Notes] Failed to mark appointment as complete:', err);
      setValidationError('Failed to complete consultation in database.');
    }
  };

  // Dynamic status styling
  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400';
      case 'connecting':
        return 'bg-amber-500/10 border-amber-500/30 text-amber-400';
      case 'failed':
        return 'bg-rose-500/10 border-rose-500/30 text-rose-400';
      default:
        return 'bg-slate-800/80 border-slate-700 text-slate-400';
    }
  };

  // Format Helper
  const getFormattedDOB = (dobStr?: string) => {
    if (!dobStr) return 'N/A';
    const date = new Date(dobStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const getDoctorNameFormatted = () => {
    if (appointment) {
      const name = typeof appointment.doctorId === 'object'
        ? (appointment.doctorId.user?.name || appointment.doctorId.name)
        : 'Practitioner';
      return name.startsWith('Dr.') ? name : `Dr. ${name}`;
    }
    return 'Dr. Specialist';
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col relative overflow-hidden font-sans select-none" style={{ minHeight: '100vh' }}>
      
      {/* Background Visual Effects */}
      <div className="absolute inset-0 bg-radial-gradient from-teal-950/20 via-indigo-950/20 to-slate-950 pointer-events-none z-0" />

      {/* Header bar */}
      <header className="w-full flex justify-between items-center px-6 py-4 backdrop-blur-md bg-slate-900/60 border-b border-slate-800/80 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-400 to-indigo-500 flex items-center justify-center font-black text-white shadow-lg shadow-cyan-500/20 text-lg">
            M
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-slate-100 flex items-center gap-2">
              MediConnect TeleConsult
              <span className="text-[10px] uppercase tracking-wider font-extrabold bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded border border-cyan-500/20">
                P2P Encrypted
              </span>
            </h1>
            <p className="text-[10px] text-slate-400 font-medium">Room ID: {roomId?.substring(0, 12)}...</p>
          </div>
        </div>

        {/* Connection status controls */}
        <div className="flex items-center gap-3">
          {connectionStatus === 'connected' && ping !== null && (
            <div className="hidden sm:flex items-center gap-1 text-[11px] font-semibold text-slate-400 bg-slate-800/60 px-2.5 py-1 rounded-xl border border-slate-700/50">
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
              <span>{ping} ms</span>
            </div>
          )}
          <span className={`px-3 py-1 border rounded-full text-[10px] font-extrabold tracking-wider flex items-center gap-1.5 shadow-sm transition-all ${getStatusColor()}`}>
            <span className={`w-1.5 h-1.5 rounded-full bg-current ${connectionStatus === 'connecting' ? 'animate-pulse' : ''}`} />
            {connectionStatus.toUpperCase()}
          </span>
        </div>
      </header>

      {/* Permission error banner */}
      {permissionTrouble && (
        <div className="max-w-2xl mx-auto mt-6 mx-4 p-5 bg-rose-500/10 border border-rose-500/30 text-rose-200 rounded-3xl flex flex-col items-center text-center gap-4 backdrop-blur-md z-15 shadow-2xl">
          <AlertCircle className="w-10 h-10 text-rose-400 animate-bounce" />
          <div>
            <h3 className="font-extrabold text-sm text-rose-300">Browser Media Access Required</h3>
            <p className="text-xs text-rose-450 mt-1 font-semibold">
              Error Details: {errorMessage}
            </p>
            <p className="text-xs text-rose-400/90 mt-1.5 leading-relaxed max-w-lg">
              To join this secure consultation room, you must allow MediConnect to access your microphone and webcam. Check your browser address bar to grant permissions, then click retry.
            </p>
          </div>
          <button
            onClick={initMediaAndSignaling}
            className="px-6 py-2 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-600/30 transition-all cursor-pointer"
          >
            Retry Permission Request
          </button>
        </div>
      )}

      {/* Main Workspace Stage */}
      <main className="flex-1 flex flex-col lg:flex-row items-stretch justify-center p-4 lg:p-6 gap-4 z-10 min-h-0 relative">
        
        {/* Left Side: Call Stream Workspace */}
        <div className="flex-1 flex flex-col relative bg-slate-900/60 border border-slate-800/65 rounded-3xl overflow-hidden shadow-2xl min-h-0">
          
          {/* Remote Video Container */}
          <div className="flex-1 w-full h-full relative bg-slate-950 flex items-center justify-center">
            
            {/* The Remote Video stream */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className={`w-full h-full object-cover transition-opacity duration-300 ${
                connectionStatus === 'connected' && remoteVideoEnabled ? 'opacity-100' : 'opacity-0 absolute pointer-events-none'
              }`}
            />

            {/* Placeholder when remote camera is disabled */}
            {connectionStatus === 'connected' && !remoteVideoEnabled && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 p-6 text-center">
                <div className="w-24 h-24 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shadow-2xl mb-4">
                  {peerInfo?.role === 'Doctor' ? (
                    <Activity className="w-10 h-10 text-cyan-400" />
                  ) : (
                    <User className="w-10 h-10 text-indigo-400" />
                  )}
                </div>
                <h4 className="font-bold text-slate-200 text-sm">
                  {peerInfo?.role === 'Doctor' ? getDoctorNameFormatted() : 'Patient'} has turned off their camera
                </h4>
                <p className="text-xs text-slate-500 mt-1">Audio stream is still connected</p>
              </div>
            )}

            {/* Connection States Overlays */}
            {(connectionStatus !== 'connected' || isOffline || signalingStatus !== 'connected') && !permissionTrouble && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/90 p-8 text-center backdrop-blur-sm">
                {isOffline ? (
                  <div className="flex flex-col items-center max-w-sm">
                    <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mb-4">
                      <WifiOff className="w-8 h-8 text-rose-400 animate-pulse" />
                    </div>
                    <h3 className="font-extrabold text-slate-100 text-sm">You are Offline</h3>
                    <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                      Your internet connection was lost. Please check your Wi-Fi or network connection. MediConnect will automatically try to reconnect when you are back online.
                    </p>
                  </div>
                ) : errorMessage && (connectionStatus === 'failed' || connectionStatus === 'idle') ? (
                  <div className="flex flex-col items-center max-w-sm">
                    <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mb-4">
                      <AlertCircle className="w-8 h-8 text-rose-400" />
                    </div>
                    <h3 className="font-extrabold text-slate-100 text-sm">Access Denied / Connection Failed</h3>
                    <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                      {errorMessage}
                    </p>
                    <button
                      onClick={() => {
                        if (targetSocketIdRef.current) {
                          initiateCall(targetSocketIdRef.current);
                        } else {
                          initMediaAndSignaling();
                        }
                      }}
                      className="mt-4 px-5 py-2 bg-slate-800 hover:bg-slate-700 active:scale-95 border border-slate-700 rounded-xl text-[11px] font-bold transition-all cursor-pointer"
                    >
                      Retry Consultation Connection
                    </button>
                  </div>
                ) : signalingStatus === 'connecting' && connectionStatus !== 'connected' ? (
                  <div className="flex flex-col items-center max-w-sm">
                    <div className="w-16 h-16 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mb-4">
                      <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
                    </div>
                    <h3 className="font-extrabold text-slate-100 text-sm">Initializing Telehealth...</h3>
                    <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                      Connecting to secure matching signaling server...
                    </p>
                  </div>
                ) : signalingStatus === 'disconnected' ? (
                  <div className="flex flex-col items-center max-w-sm">
                    <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-4">
                      <ServerCrash className="w-8 h-8 text-amber-400 animate-pulse" />
                    </div>
                    <h3 className="font-extrabold text-slate-100 text-sm">Signaling Interrupted</h3>
                    <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                      Lost secure connection to the matching server. Reconnecting to the consultation system...
                    </p>
                  </div>
                ) : connectionStatus === 'reconnecting' ? (
                  <div className="flex flex-col items-center max-w-sm">
                    <div className="w-16 h-16 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mb-4">
                      <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
                    </div>
                    <h3 className="font-extrabold text-slate-100 text-sm">Reconnecting Stream...</h3>
                    <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                      The call connection was temporarily lost. Attempting to restore secure connection with {peerInfo?.role === 'Doctor' ? getDoctorNameFormatted() : 'Patient'}...
                    </p>
                  </div>
                ) : connectionStatus === 'failed' ? (
                  <div className="flex flex-col items-center max-w-sm">
                    <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mb-4">
                      <AlertCircle className="w-8 h-8 text-rose-450" />
                    </div>
                    <h3 className="font-extrabold text-slate-100 text-sm">Connection Failed</h3>
                    <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                      Could not establish or maintain audio/video stream connection.
                    </p>
                    <button
                      onClick={() => {
                        if (targetSocketIdRef.current) {
                          initiateCall(targetSocketIdRef.current);
                        } else {
                          initMediaAndSignaling();
                        }
                      }}
                      className="mt-4 px-5 py-2 bg-slate-800 hover:bg-slate-700 active:scale-95 border border-slate-700 rounded-xl text-[11px] font-bold transition-all cursor-pointer"
                    >
                      Retry Call Connection
                    </button>
                  </div>
                ) : connectionStatus === 'disconnected' && peerInfo ? (
                  <div className="flex flex-col items-center max-w-sm">
                    <div className="w-16 h-16 rounded-full bg-slate-850 border border-slate-700/50 flex items-center justify-center mb-4 animate-pulse">
                      {peerInfo.role === 'Doctor' ? (
                        <Activity className="w-8 h-8 text-cyan-400" />
                      ) : (
                        <User className="w-8 h-8 text-indigo-400" />
                      )}
                    </div>
                    <h3 className="font-extrabold text-slate-100 text-sm">Participant Disconnected</h3>
                    <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                      {peerInfo.role === 'Doctor' ? getDoctorNameFormatted() : 'Patient'} has disconnected. Waiting for them to rejoin the room...
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center max-w-sm">
                    <div className="w-20 h-20 rounded-full bg-slate-800/80 flex items-center justify-center border border-slate-700/50 shadow-inner mb-5 animate-pulse">
                      {user?.role === 'Patient' ? (
                        <Activity className="w-8 h-8 text-cyan-400" />
                      ) : (
                        <User className="w-8 h-8 text-indigo-400" />
                      )}
                    </div>
                    <h3 className="font-extrabold text-slate-200 text-sm">
                      {peerInfo 
                        ? `Establishing secure connection with ${peerInfo.role === 'Doctor' ? 'Dr. ' + peerInfo.userId : 'Patient'}...`
                        : 'Waiting for other participant to join...'}
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-1.5 max-w-sm leading-relaxed">
                      Once they enter the consultation room, a secure peer-to-peer audio and video stream will initiate immediately.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Remote Peer Audio Indicator (If Muted) */}
            {connectionStatus === 'connected' && !remoteAudioEnabled && (
              <div className="absolute top-4 left-4 bg-rose-500/20 border border-rose-500/30 text-rose-300 backdrop-blur-md px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5">
                <MicOff className="w-3.5 h-3.5" />
                <span>Muted</span>
              </div>
            )}

            {/* Remote Identity Overlay */}
            {connectionStatus === 'connected' && peerInfo && (
              <div className="absolute bottom-4 left-4 px-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 backdrop-blur-md text-[11px] font-bold text-slate-200 flex items-center gap-2">
                {peerInfo.role === 'Doctor' ? (
                  <Activity className="w-3.5 h-3.5 text-cyan-400" />
                ) : (
                  <User className="w-3.5 h-3.5 text-indigo-400" />
                )}
                <span>
                  {peerInfo.role === 'Doctor' ? getDoctorNameFormatted() : (
                    appointment && typeof appointment.patientId === 'object'
                      ? (appointment.patientId.user?.name || appointment.patientId.name)
                      : 'Patient'
                  )}
                </span>
              </div>
            )}

            {/* Local Video Overlay (Floating PIP) */}
            <div className="absolute bottom-4 right-4 w-36 h-28 sm:w-52 sm:h-38 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl z-20 group">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover transform scale-x-[-1] transition-opacity duration-300 ${
                  videoEnabled ? 'opacity-100' : 'opacity-0 absolute pointer-events-none'
                }`}
              />
              
              <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-lg bg-slate-950/80 backdrop-blur-sm text-[9px] font-extrabold text-slate-300">
                You ({user?.role})
              </div>

              {!videoEnabled && (
                <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center gap-1.5">
                  <div className="w-8 h-8 rounded-full bg-slate-850 flex items-center justify-center text-slate-400 border border-slate-800">
                    <VideoOff className="w-4 h-4 text-rose-500" />
                  </div>
                  <span className="text-[9px] text-slate-400 font-semibold">Camera Off</span>
                </div>
              )}

              {!audioEnabled && (
                <div className="absolute top-2 right-2 p-1 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  <MicOff className="w-2.5 h-2.5" />
                </div>
              )}
            </div>

          </div>

        </div>

        {/* Right Side: Collapsible Sidebar (Details / Chart / Notes) */}
        {sidebarOpen && (
          <div className="w-full lg:w-96 bg-slate-900/90 border border-slate-800/80 rounded-3xl flex flex-col overflow-hidden shadow-2xl relative backdrop-blur-md transition-all shrink-0">
            
            {/* Sidebar Navigation */}
            {user?.role === 'Doctor' ? (
              <div className="flex border-b border-slate-800">
                <button
                  onClick={() => setSidebarTab('soap')}
                  className={`flex-1 py-3 text-xs font-bold border-b-2 flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    sidebarTab === 'soap' 
                      ? 'border-cyan-500 text-cyan-400 bg-slate-800/20' 
                      : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/10'
                  }`}
                >
                  <Clipboard className="w-3.5 h-3.5" />
                  SOAP Notes
                </button>
                <button
                  onClick={() => setSidebarTab('chart')}
                  className={`flex-1 py-3 text-xs font-bold border-b-2 flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    sidebarTab === 'chart' 
                      ? 'border-cyan-500 text-cyan-400 bg-slate-800/20' 
                      : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/10'
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  Chart
                </button>
                <button
                  onClick={() => setSidebarTab('history')}
                  className={`flex-1 py-3 text-xs font-bold border-b-2 flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    sidebarTab === 'history' 
                      ? 'border-cyan-500 text-cyan-400 bg-slate-800/20' 
                      : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/10'
                  }`}
                >
                  <History className="w-3.5 h-3.5" />
                  EHR History
                </button>
              </div>
            ) : (
              <div className="px-5 py-4 border-b border-slate-800/80 flex items-center gap-2">
                <Info className="w-4 h-4 text-indigo-400" />
                <h3 className="font-extrabold text-slate-200 text-xs uppercase tracking-wider">Consultation Workspace</h3>
              </div>
            )}

            {/* Sidebar Content Container */}
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
              
              {loadingMetadata ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-450 gap-2 py-20">
                  <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
                  <span className="text-xs">Synchronizing clinical data...</span>
                </div>
              ) : (
                <>
                  {/* DOCTOR SIDEBAR VIEWS */}
                  {user?.role === 'Doctor' && (
                    <>
                      {/* View 1: SOAP clinical notes */}
                      {sidebarTab === 'soap' && (
                        <form onSubmit={saveClinicalSOAPNote} className="flex flex-col gap-4">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] uppercase font-black text-cyan-400 tracking-wider flex items-center gap-1">
                              <FileText className="w-3 h-3" /> Live SOAP Documentation
                            </span>
                            {existingNoteId && (
                              <span className="text-[9px] bg-emerald-500/15 border border-emerald-500/35 text-emerald-400 px-2 py-0.5 rounded-full font-bold">
                                SAVED
                              </span>
                            )}
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                              Subjective Findings (Patient's complaint & symptoms)
                            </label>
                            <textarea
                              value={subjective}
                              onChange={(e) => setSubjective(e.target.value)}
                              placeholder="Describe patient symptoms, history of present illness..."
                              className="w-full h-24 bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-650 focus:outline-none focus:border-cyan-550 resize-none font-sans"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                              Objective Findings (Clinical vitals & observation)
                            </label>
                            <textarea
                              value={objective}
                              onChange={(e) => setObjective(e.target.value)}
                              placeholder="Vitals, clinical signs, direct observations..."
                              className="w-full h-24 bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-650 focus:outline-none focus:border-cyan-550 resize-none font-sans"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                              Assessment (Diagnosis & clinical hypotheses)
                            </label>
                            <textarea
                              value={assessment}
                              onChange={(e) => setAssessment(e.target.value)}
                              placeholder="Clinical diagnosis, Differential diagnoses..."
                              className="w-full h-20 bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-650 focus:outline-none focus:border-cyan-550 resize-none font-sans"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                              Plan (Treatment, tests, medicines)
                            </label>
                            <textarea
                              value={plan}
                              onChange={(e) => setPlan(e.target.value)}
                              placeholder="Recommended medications, follow-up timeline, tests..."
                              className="w-full h-20 bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-650 focus:outline-none focus:border-cyan-550 resize-none font-sans"
                            />
                          </div>

                          {validationError && (
                            <p className="text-[10px] font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-xl">
                              {validationError}
                            </p>
                          )}

                          <div className="flex gap-2 mt-2">
                            <button
                              type="submit"
                              disabled={noteSaving}
                              className="flex-1 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 active:scale-98 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-cyan-600/20 transition-all disabled:opacity-50"
                            >
                              {noteSaving ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Save className="w-3.5 h-3.5" />
                              )}
                              {existingNoteId ? 'Update SOAP Note' : 'Save SOAP Note'}
                            </button>

                            {existingNoteId && (
                              <button
                                type="button"
                                onClick={handleCompleteAppointment}
                                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
                                title="Submit note & mark appointment completed"
                              >
                                End Consult
                              </button>
                            )}
                          </div>

                          {noteSaveSuccess && (
                            <div className="flex items-center justify-center gap-1.5 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 py-2 rounded-xl text-xs font-bold animate-pulse">
                              <CheckCircle className="w-4 h-4" />
                              <span>Progress Saved Successfully!</span>
                            </div>
                          )}
                        </form>
                      )}

                      {/* View 2: Patient Chart Info */}
                      {sidebarTab === 'chart' && (
                        <div className="space-y-5">
                          <div>
                            <span className="text-[10px] uppercase font-black text-cyan-400 tracking-wider block mb-2">Patient Profile</span>
                            <div className="bg-slate-950/60 border border-slate-800 p-3.5 rounded-2xl space-y-2">
                              <div className="flex justify-between border-b border-slate-800/80 pb-1.5">
                                <span className="text-[10px] text-slate-450 font-semibold">Name</span>
                                <span className="text-xs font-bold text-slate-200">
                                  {appointment && typeof appointment.patientId === 'object'
                                    ? (appointment.patientId.user?.name || appointment.patientId.name)
                                    : 'Patient User'}
                                </span>
                              </div>
                              <div className="flex justify-between border-b border-slate-800/80 pb-1.5">
                                <span className="text-[10px] text-slate-450 font-semibold">Date of Birth</span>
                                <span className="text-xs font-bold text-slate-200">{getFormattedDOB(patientProfile?.dateOfBirth)}</span>
                              </div>
                              <div className="flex justify-between border-b border-slate-800/80 pb-1.5">
                                <span className="text-[10px] text-slate-450 font-semibold">Gender</span>
                                <span className="text-xs font-bold text-slate-200">{patientProfile?.gender || 'Not specified'}</span>
                              </div>
                              <div className="flex justify-between border-b border-slate-800/80 pb-1.5">
                                <span className="text-[10px] text-slate-450 font-semibold">Blood Group</span>
                                <span className="text-xs font-bold text-slate-200">{patientProfile?.bloodGroup || 'N/A'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-[10px] text-slate-450 font-semibold">Phone</span>
                                <span className="text-xs font-bold text-slate-200">{patientProfile?.phone || 'No phone'}</span>
                              </div>
                            </div>
                          </div>

                          {/* Allergies section */}
                          <div>
                            <span className="text-[10px] uppercase font-black text-rose-400 tracking-wider block mb-2 flex items-center gap-1">
                              <Heart className="w-3 h-3" /> Active Allergies
                            </span>
                            <div className="bg-rose-500/5 border border-rose-500/10 p-3.5 rounded-2xl">
                              {patientProfile?.allergies && patientProfile.allergies.length > 0 ? (
                                <div className="flex flex-wrap gap-1.5">
                                  {patientProfile.allergies.map((allergy, index) => (
                                    <span key={index} className="text-[10px] bg-rose-500/15 border border-rose-500/30 text-rose-300 font-extrabold px-2.5 py-0.5 rounded-md">
                                      {allergy}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-xs text-slate-500 italic">No allergies recorded in chart</span>
                              )}
                            </div>
                          </div>

                          {/* Chronic Medical History */}
                          <div>
                            <span className="text-[10px] uppercase font-black text-cyan-400 tracking-wider block mb-2">Medical History</span>
                            <div className="bg-slate-950/60 border border-slate-800 p-3.5 rounded-2xl">
                              {patientProfile?.medicalHistory && patientProfile.medicalHistory.length > 0 ? (
                                <ul className="space-y-1.5">
                                  {patientProfile.medicalHistory.map((history, idx) => (
                                    <li key={idx} className="text-xs text-slate-300 flex items-start gap-2">
                                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-1.5 shrink-0" />
                                      <span>{history}</span>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <span className="text-xs text-slate-500 italic">No medical history on record</span>
                              )}
                            </div>
                          </div>

                          {/* Reason for Visit */}
                          {appointment && (
                            <div>
                              <span className="text-[10px] uppercase font-black text-indigo-400 tracking-wider block mb-2">Complaint / Reason for Visit</span>
                              <div className="bg-indigo-500/5 border border-indigo-500/10 p-3.5 rounded-2xl">
                                <p className="text-xs text-slate-300 font-medium leading-relaxed">{appointment.reasonForVisit}</p>
                                {appointment.notes && (
                                  <p className="text-[11px] text-slate-500 mt-2 border-t border-slate-800 pt-1.5 italic">
                                    Appointment Notes: {appointment.notes}
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* View 3: EHR Medical Records History */}
                      {sidebarTab === 'history' && (
                        <div className="space-y-4">
                          <span className="text-[10px] uppercase font-black text-cyan-400 tracking-wider block mb-1">EHR Records History</span>
                          {medicalRecords.length === 0 ? (
                            <div className="text-center py-8 bg-slate-950/50 border border-slate-800 rounded-2xl text-slate-550 italic text-xs">
                              No prior clinical EHR records available
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {medicalRecords.map((record) => (
                                <div key={record._id} className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-2 text-xs">
                                  <div className="flex justify-between items-center border-b border-slate-800/80 pb-1.5">
                                    <span className="font-extrabold text-slate-300">{record.diagnosis}</span>
                                    <span className="text-[9px] font-bold text-slate-500 bg-slate-850 px-2 py-0.5 rounded border border-slate-800">
                                      {new Date(record.visitDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                                    </span>
                                  </div>
                                  <p className="text-slate-400"><span className="font-bold text-slate-350">Symptoms:</span> {record.symptoms}</p>
                                  <p className="text-slate-400"><span className="font-bold text-slate-350">Treatment:</span> {record.treatmentPlan}</p>
                                  {record.prescription && record.prescription.medicines.length > 0 && (
                                    <div className="mt-2 bg-indigo-950/15 border border-indigo-950/20 p-2 rounded-xl">
                                      <span className="text-[9px] font-black text-indigo-400 block mb-1">Prescribed Medicines</span>
                                      <div className="space-y-1">
                                        {record.prescription.medicines.map((med, index) => (
                                          <div key={index} className="text-[10px] text-slate-300 flex justify-between">
                                            <span>{med.name}</span>
                                            <span className="opacity-75">{med.dosage} · {med.frequency}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {/* PATIENT SIDEBAR VIEWS */}
                  {user?.role === 'Patient' && (
                    <div className="space-y-5">
                      <div>
                        <span className="text-[10px] uppercase font-black text-indigo-400 tracking-wider block mb-2">Appointment Details</span>
                        <div className="bg-slate-950/60 border border-slate-850 p-4 rounded-2xl space-y-3">
                          <div className="flex items-start gap-3">
                            <Clock className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
                            <div>
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Time slot</span>
                              <span className="text-xs font-semibold text-slate-200">
                                {appointment ? `${appointment.startTime} - ${appointment.endTime}` : 'Loading...'}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-start gap-3">
                            <Calendar className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
                            <div>
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Consultation Date</span>
                              <span className="text-xs font-semibold text-slate-200">
                                {appointment ? new Date(appointment.appointmentDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'Loading...'}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-start gap-3">
                            <User className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
                            <div>
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Assigned Doctor</span>
                              <span className="text-xs font-bold text-slate-200">
                                {getDoctorNameFormatted()}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div>
                        <span className="text-[10px] uppercase font-black text-indigo-400 tracking-wider block mb-2">Clinical Note Notice</span>
                        <div className="bg-slate-950/60 border border-slate-850 p-4 rounded-2xl text-xs text-slate-400 leading-relaxed space-y-2">
                          <p>
                            During this online consultation, your doctor may write clinical SOAP notes, diagnose symptoms, and issue digital prescriptions.
                          </p>
                          <p className="text-slate-500">
                            Once marked complete, all medical findings, prescriptions, and follow-ups will be encrypted and saved in your Patient Dashboard under **Medical Records**.
                          </p>
                        </div>
                      </div>

                      <div>
                        <span className="text-[10px] uppercase font-black text-cyan-400 tracking-wider block mb-2">Reason for Consultation</span>
                        <div className="bg-slate-950/60 border border-slate-850 p-4 rounded-2xl text-xs text-slate-300 font-medium">
                          {appointment ? appointment.reasonForVisit : 'Consultation details loading...'}
                        </div>
                      </div>
                    </div>
                  )}

                </>
              )}

            </div>
          </div>
        )}

      </main>

      {/* Bottom Controls Bar */}
      <footer className="w-full py-6 backdrop-blur-md bg-slate-900/60 border-t border-slate-800/80 flex justify-center items-center gap-4 z-10">
        
        {/* Toggle Sidebar Action */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className={`w-12 h-12 rounded-full flex items-center justify-center border transition-all cursor-pointer bg-slate-850 hover:bg-slate-800 border-slate-700 text-slate-350`}
          title={sidebarOpen ? 'Collapse Details Panel' : 'Expand Details Panel'}
        >
          {sidebarOpen ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>

        <div className="w-[1px] h-6 bg-slate-800/80 mx-1" />

        {/* Toggle Microphone */}
        <button
          onClick={toggleAudio}
          className={`w-12 h-12 rounded-full flex items-center justify-center border transition-all cursor-pointer ${
            audioEnabled 
              ? 'bg-slate-850 hover:bg-slate-800 border-slate-700 text-slate-200' 
              : 'bg-rose-500/20 hover:bg-rose-500/30 border-rose-500/30 text-rose-400'
          }`}
          title={audioEnabled ? 'Mute Microphone' : 'Unmute Microphone'}
        >
          {audioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
        </button>

        {/* Toggle Video */}
        <button
          onClick={toggleVideo}
          className={`w-12 h-12 rounded-full flex items-center justify-center border transition-all cursor-pointer ${
            videoEnabled 
              ? 'bg-slate-850 hover:bg-slate-800 border-slate-700 text-slate-200' 
              : 'bg-rose-500/20 hover:bg-rose-500/30 border-rose-500/30 text-rose-400'
          }`}
          title={videoEnabled ? 'Turn Camera Off' : 'Turn Camera On'}
        >
          {videoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
        </button>

        <div className="w-[1px] h-6 bg-slate-800/80 mx-1" />

        {/* Hang up call */}
        <button
          onClick={handleHangUp}
          className="w-14 h-12 rounded-3xl bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center font-bold shadow-lg shadow-rose-600/30 hover:scale-105 active:scale-95 transition-all cursor-pointer"
          title="Disconnect call"
        >
          <PhoneOff className="w-5 h-5" />
        </button>

      </footer>
    </div>
  );
};

export default VideoCallPage;
