import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../store/authStore';
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  PhoneOff, 
  RefreshCw, 
  AlertCircle,
  User,
  Activity,
  Volume2
} from 'lucide-react';

export const VideoCallPage: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'disconnected' | 'failed'>('idle');
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [peerInfo, setPeerInfo] = useState<{ userId: string; role: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const socketRef = useRef<Socket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const targetSocketIdRef = useRef<string | null>(null);

  const SIGNALING_URL = import.meta.env.VITE_SIGNALING_URL || 'http://localhost:5001';

  useEffect(() => {
    if (!roomId || !user) {
      setErrorMessage('Invalid meeting room or user session.');
      return;
    }

    // 1. Initialize local media
    const initMediaAndSignaling = async () => {
      try {
        setConnectionStatus('connecting');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // Initialize Signaling Socket
        const socket = io(SIGNALING_URL, {
          transports: ['websocket'],
          forceNew: true
        });
        socketRef.current = socket;

        socket.on('connect', () => {
          console.log('[WebRTC Client] Socket connected:', socket.id);
          socket.emit('join-room', {
            roomId,
            userId: user.id,
            role: user.role
          });
        });

        socket.on('room-users', async ({ users }) => {
          console.log('[WebRTC Client] Room users received:', users);
          // Find other peer in the room
          const otherUser = users.find((u: any) => u.socketId !== socket.id);
          if (otherUser) {
            targetSocketIdRef.current = otherUser.socketId;
            setPeerInfo({ userId: otherUser.userId, role: otherUser.role });
            // Since we joined and there's already someone here, we initiate the call offer
            await initiateCall(otherUser.socketId);
          }
        });

        socket.on('user-joined', ({ socketId, userId, role }) => {
          console.log('[WebRTC Client] User joined:', userId, socketId);
          targetSocketIdRef.current = socketId;
          setPeerInfo({ userId, role });
          // Note: The new joiner will initiate the offer once they get 'room-users'
        });

        socket.on('offer', async ({ senderSocketId, offer }) => {
          console.log('[WebRTC Client] Offer received from:', senderSocketId);
          targetSocketIdRef.current = senderSocketId;
          await handleReceivedOffer(senderSocketId, offer);
        });

        socket.on('answer', async ({ senderSocketId, answer }) => {
          console.log('[WebRTC Client] Answer received from:', senderSocketId);
          if (pcRef.current) {
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
            setConnectionStatus('connected');
          }
        });

        socket.on('ice-candidate', async ({ senderSocketId, candidate }) => {
          console.log('[WebRTC Client] ICE candidate received from:', senderSocketId);
          if (pcRef.current) {
            try {
              await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (err) {
              console.error('[WebRTC Client] Error adding ice candidate:', err);
            }
          }
        });

        socket.on('user-left', ({ socketId, userId }) => {
          console.log('[WebRTC Client] Peer left:', userId, socketId);
          if (targetSocketIdRef.current === socketId) {
            cleanPeerConnection();
            setConnectionStatus('disconnected');
            setPeerInfo(null);
          }
        });

        socket.on('error', ({ message }) => {
          console.error('[WebRTC Client] Signaling server error:', message);
          setErrorMessage(message);
        });

        socket.on('disconnect', () => {
          console.log('[WebRTC Client] Socket disconnected');
          setConnectionStatus('disconnected');
        });

      } catch (err: any) {
        console.error('[WebRTC Client] Media acquisition failed:', err);
        setErrorMessage(
          'Could not access camera or microphone. Please ensure permissions are granted and devices are connected.'
        );
        setConnectionStatus('failed');
      }
    };

    initMediaAndSignaling();

    return () => {
      cleanupAll();
    };
  }, [roomId, user]);

  // Create PeerConnection & add local tracks
  const createPeerConnection = (targetSocketId: string): RTCPeerConnection => {
    if (pcRef.current) {
      return pcRef.current;
    }

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ]
    });

    // Add local tracks to the connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    // Handle remote tracks
    pc.ontrack = (event) => {
      console.log('[WebRTC Client] Remote track received:', event.streams[0]);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
      setConnectionStatus('connected');
    };

    // Send local ICE candidates to peer
    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        console.log('[WebRTC Client] Sending local ICE candidate to:', targetSocketId);
        socketRef.current.emit('ice-candidate', {
          roomId,
          targetSocketId,
          candidate: event.candidate
        });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('[WebRTC Client] Peer connection state:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        setConnectionStatus('connected');
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'closed') {
        setConnectionStatus('disconnected');
      } else if (pc.connectionState === 'failed') {
        setConnectionStatus('failed');
      }
    };

    pcRef.current = pc;
    return pc;
  };

  // Caller side: create and send offer
  const initiateCall = async (targetSocketId: string) => {
    console.log('[WebRTC Client] Initiating call to socket:', targetSocketId);
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

  // Receiver side: handle offer, set remote desc, create and send answer
  const handleReceivedOffer = async (senderSocketId: string, offer: RTCSessionDescriptionInit) => {
    console.log('[WebRTC Client] Handling offer from socket:', senderSocketId);
    try {
      const pc = createPeerConnection(senderSocketId);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));

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
      console.error('[WebRTC Client] Failed to handle call offer/answer:', err);
      setErrorMessage('Failed to negotiate peer connection.');
    }
  };

  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setAudioEnabled(audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setVideoEnabled(videoTrack.enabled);
      }
    }
  };

  const cleanPeerConnection = () => {
    if (pcRef.current) {
      pcRef.current.onicecandidate = null;
      pcRef.current.ontrack = null;
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.close();
      pcRef.current = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
  };

  const cleanupAll = () => {
    cleanPeerConnection();

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    if (socketRef.current) {
      socketRef.current.emit('leave-room');
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  };

  const handleHangUp = () => {
    cleanupAll();
    const dashboardPath = user?.role === 'Doctor' ? '/doctor/dashboard' : '/patient/dashboard';
    navigate(dashboardPath);
  };

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'bg-emerald-500 text-emerald-50';
      case 'connecting':
        return 'bg-amber-500 text-amber-50';
      case 'failed':
        return 'bg-rose-500 text-rose-50';
      default:
        return 'bg-slate-600 text-slate-100';
    }
  };

  return (
    <div className="min-h-screen bg-slate-955 text-white flex flex-col relative overflow-hidden font-sans select-none" style={{ minHeight: '100vh' }}>
      {/* Background visual ambiance */}
      <div className="absolute inset-0 bg-radial-gradient from-teal-950/20 via-indigo-950/20 to-slate-950 pointer-events-none z-0" />

      {/* Header bar */}
      <header className="w-full flex justify-between items-center px-6 py-4 backdrop-blur-md bg-slate-900/60 border-b border-slate-800 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-linear-to-br from-teal-400 to-indigo-500 flex items-center justify-center font-black text-white shadow-lg shadow-teal-500/20 text-lg">
            M
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-slate-100">MediConnect TeleConsult</h1>
            <p className="text-[10px] text-slate-400 font-medium">Session Room: {roomId?.substring(0, 8)}...</p>
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all ${getStatusColor()}`}>
            <span className={`w-1.5 h-1.5 rounded-full bg-current ${connectionStatus === 'connecting' ? 'animate-pulse' : ''}`} />
            {connectionStatus.toUpperCase()}
          </span>
        </div>
      </header>

      {/* Error Callout */}
      {errorMessage && (
        <div className="max-w-xl mx-auto mt-4 px-4 py-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-2xl flex items-start gap-3 text-xs backdrop-blur-md z-10">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block">Hardware or Network Exception</span>
            <span className="opacity-80">{errorMessage}</span>
          </div>
        </div>
      )}

      {/* Main Video Stage */}
      <main className="flex-1 flex flex-col lg:flex-row items-center justify-center p-4 lg:p-6 gap-4 z-10 min-h-0 relative">
        {/* Remote Video Container (Main canvas) */}
        <div className="flex-1 w-full h-full min-h-[350px] bg-slate-900 border border-slate-800/80 rounded-3xl overflow-hidden relative shadow-2xl flex items-center justify-center">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover transform scale-x-[-1]"
          />

          {/* Fallback when remote stream isn't connected */}
          {connectionStatus !== 'connected' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 text-center p-6">
              <div className="w-20 h-20 rounded-full bg-slate-800/80 flex items-center justify-center border border-slate-700/50 shadow-inner mb-4 animate-pulse">
                {peerInfo?.role === 'Doctor' ? (
                  <Activity className="w-8 h-8 text-teal-400" />
                ) : (
                  <User className="w-8 h-8 text-indigo-400" />
                )}
              </div>
              <h3 className="font-bold text-slate-200 text-sm">
                {peerInfo 
                  ? `Connecting to ${peerInfo.role === 'Doctor' ? 'Dr.' : 'Patient'} ${peerInfo.userId}...`
                  : 'Waiting for other participant to join...'}
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-xs">
                Once the other participant enters this virtual consult room, the secure call will establish automatically.
              </p>
            </div>
          )}

          {/* Remote Identity Overlay */}
          {connectionStatus === 'connected' && peerInfo && (
            <div className="absolute bottom-4 left-4 px-3 py-1.5 rounded-xl bg-slate-950/75 border border-slate-800/60 backdrop-blur-md text-[11px] font-semibold text-slate-200 flex items-center gap-1.5">
              {peerInfo.role === 'Doctor' ? <Activity className="w-3.5 h-3.5 text-teal-400" /> : <User className="w-3.5 h-3.5 text-indigo-400" />}
              <span>{peerInfo.role}: {peerInfo.userId}</span>
            </div>
          )}
        </div>

        {/* Local Video Overlay (Picture-in-picture style) */}
        <div className="w-48 h-36 lg:w-64 lg:h-48 bg-slate-900 border-2 border-slate-800 rounded-2xl overflow-hidden shadow-2xl relative shrink-0">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover transform scale-x-[-1]"
          />
          <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-lg bg-slate-950/75 backdrop-blur-md text-[9px] font-bold text-slate-300">
            You ({user?.role})
          </div>
          
          {/* Mute overlays */}
          {!videoEnabled && (
            <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center gap-1">
              <VideoOff className="w-6 h-6 text-rose-500" />
              <span className="text-[9px] text-slate-400">Camera Off</span>
            </div>
          )}
        </div>
      </main>

      {/* Bottom Controls Bar */}
      <footer className="w-full py-6 backdrop-blur-md bg-slate-900/60 border-t border-slate-800 flex justify-center items-center gap-4 z-10">
        <button
          onClick={toggleAudio}
          className={`w-12 h-12 rounded-full flex items-center justify-center border transition-all cursor-pointer ${
            audioEnabled 
              ? 'bg-slate-800/80 hover:bg-slate-700/80 border-slate-700 text-slate-200' 
              : 'bg-rose-500/20 hover:bg-rose-500/30 border-rose-500/30 text-rose-400'
          }`}
          title={audioEnabled ? 'Mute Microphone' : 'Unmute Microphone'}
        >
          {audioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
        </button>

        <button
          onClick={toggleVideo}
          className={`w-12 h-12 rounded-full flex items-center justify-center border transition-all cursor-pointer ${
            videoEnabled 
              ? 'bg-slate-800/80 hover:bg-slate-700/80 border-slate-700 text-slate-200' 
              : 'bg-rose-500/20 hover:bg-rose-500/30 border-rose-500/30 text-rose-400'
          }`}
          title={videoEnabled ? 'Turn Camera Off' : 'Turn Camera On'}
        >
          {videoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
        </button>

        <div className="w-[1px] h-6 bg-slate-800 mx-2" />

        <button
          onClick={handleHangUp}
          className="w-14 h-12 rounded-3xl bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center font-bold shadow-lg shadow-rose-600/30 hover:scale-105 transition-all cursor-pointer"
          title="End Consultation"
        >
          <PhoneOff className="w-5 h-5" />
        </button>
      </footer>
    </div>
  );
};

export default VideoCallPage;
