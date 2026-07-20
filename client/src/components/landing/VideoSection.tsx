import React, { useRef, useState, useEffect } from 'react';
import { motion, useInView } from 'framer-motion';

const VideoSection: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });
  const [isPlaying, setIsPlaying] = useState(false);

  const VIDEO_ID = 'JyECrGp-Sw8'; // YouTube telemedicine/healthcare demo

  return (
    <section
      id="video"
      className="relative py-24 overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #ffffff 0%, #f0f9ff 50%, #f8fbff 100%)' }}
    >
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full blur-3xl opacity-30"
          style={{ background: 'radial-gradient(circle, rgba(6,182,212,0.15) 0%, transparent 70%)' }}
        />
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
          ref={ref}
        >
          <span className="section-badge mb-4 inline-flex">
            <span className="w-1.5 h-1.5 rounded-full bg-[#06b6d4] animate-pulse" />
            See MediConnect in Action
          </span>
          <h2 className="font-display font-700 text-4xl sm:text-5xl text-[#0f172a] mt-4 mb-4">
            The Future of{' '}
            <span className="text-gradient">Healthcare Is Here</span>
          </h2>
          <p className="text-[#475569] text-lg max-w-2xl mx-auto">
            Watch how MediConnect transforms the patient-doctor relationship through
            seamless technology, secure consultations, and compassionate care.
          </p>
        </motion.div>

        {/* Video Container */}
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.96 }}
          animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="relative group cursor-pointer"
          onClick={() => setIsPlaying(true)}
          whileHover={{ scale: 1.01 }}
        >
          {/* Glass card wrapper */}
          <div
            className="relative rounded-3xl overflow-hidden shadow-[0_30px_80px_rgba(37,99,235,0.15),0_8px_20px_rgba(0,0,0,0.06)]"
            style={{
              border: '1px solid rgba(37,99,235,0.12)',
              background: 'rgba(255,255,255,0.8)',
            }}
          >
            {/* Aspect ratio container */}
            <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
              {!isPlaying ? (
                <>
                  {/* Thumbnail overlay */}
                  <div
                    className="absolute inset-0 flex items-center justify-center"
                    style={{
                      background: 'linear-gradient(135deg, rgba(15,23,42,0.85) 0%, rgba(30,58,138,0.75) 50%, rgba(14,116,144,0.7) 100%)',
                    }}
                  >
                    {/* Medical grid pattern */}
                    <div
                      className="absolute inset-0 opacity-10"
                      style={{
                        backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
                        backgroundSize: '30px 30px',
                      }}
                    />

                    {/* Floating elements in thumbnail */}
                    <div className="absolute top-6 left-6 flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-xl px-3 py-2 border border-white/20">
                      <div className="w-2 h-2 rounded-full bg-[#14b8a6] animate-pulse" />
                      <span className="text-white text-xs font-semibold">Live Consultation</span>
                    </div>
                    <div className="absolute top-6 right-6 flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-xl px-3 py-2 border border-white/20">
                      <span className="text-white text-xs font-semibold">🔒 Encrypted</span>
                    </div>

                    {/* Center Play Button */}
                    <motion.div
                      className="relative z-10 flex flex-col items-center gap-4"
                      whileHover={{ scale: 1.05 }}
                    >
                      <div className="relative">
                        {/* Pulse rings */}
                        <div className="absolute inset-0 rounded-full bg-white/20 animate-ping scale-110" />
                        <div className="absolute inset-0 rounded-full bg-white/10 animate-ping scale-125" style={{ animationDelay: '0.3s' }} />
                        {/* Button */}
                        <div className="relative w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-[0_4px_30px_rgba(255,255,255,0.3)]">
                          <svg className="w-8 h-8 text-[#2563eb] ml-1" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </div>
                      </div>
                      <div className="text-center">
                        <p className="text-white font-semibold text-lg">Watch Demo</p>
                        <p className="text-white/60 text-sm">Healthcare Technology Overview</p>
                      </div>
                    </motion.div>

                    {/* Bottom stats bar */}
                    <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-8">
                      {[
                        { icon: '👥', value: '10K+', label: 'Active Users' },
                        { icon: '📅', value: '500+', label: 'Daily Appointments' },
                        { icon: '⭐', value: '4.9', label: 'Rating' },
                      ].map((stat) => (
                        <div key={stat.label} className="flex items-center gap-2 text-white">
                          <span>{stat.icon}</span>
                          <div>
                            <div className="font-bold text-sm">{stat.value}</div>
                            <div className="text-white/60 text-xs">{stat.label}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <iframe
                  className="absolute inset-0 w-full h-full"
                  src={`https://www.youtube.com/embed/${VIDEO_ID}?autoplay=1&mute=1&rel=0&modestbranding=1&showinfo=0`}
                  title="MediConnect — Healthcare Demo"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              )}
            </div>
          </div>

          {/* Glow behind card */}
          <div
            className="absolute -inset-4 rounded-3xl blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none -z-10"
            style={{ background: 'radial-gradient(ellipse, rgba(37,99,235,0.12) 0%, transparent 70%)' }}
          />
        </motion.div>

        {/* Feature badges below video */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="flex flex-wrap justify-center gap-4 mt-10"
        >
          {[
            { icon: '🎥', label: 'HD Video Calls' },
            { icon: '📋', label: 'Digital Prescriptions' },
            { icon: '🔐', label: 'End-to-End Encrypted' },
            { icon: '📱', label: 'Mobile Friendly' },
            { icon: '⚡', label: 'Instant Booking' },
          ].map((badge) => (
            <div
              key={badge.label}
              className="flex items-center gap-2 px-4 py-2 rounded-full glass border border-[#2563eb]/10 text-sm text-[#475569] font-medium"
            >
              <span>{badge.icon}</span>
              <span>{badge.label}</span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default VideoSection;
