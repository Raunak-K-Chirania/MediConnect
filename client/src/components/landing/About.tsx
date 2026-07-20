import React, { useRef } from 'react';
import { motion, useInView, type Variants } from 'framer-motion';

const FEATURES = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.87V15.13a1 1 0 01-1.447.9L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    ),
    title: 'Secure Video Consultation',
    description: 'Crystal-clear HD video calls with end-to-end encryption, ensuring your medical consultations stay completely private.',
    color: '#2563eb',
    bg: 'rgba(37,99,235,0.07)',
    border: 'rgba(37,99,235,0.12)',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    title: 'Smart Appointment Scheduling',
    description: 'AI-powered scheduling system that finds optimal time slots, sends reminders, and handles rescheduling automatically.',
    color: '#06b6d4',
    bg: 'rgba(6,182,212,0.07)',
    border: 'rgba(6,182,212,0.12)',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    title: 'Electronic Health Records',
    description: 'Comprehensive digital health records accessible anywhere, with complete medical history, lab results, and imaging.',
    color: '#14b8a6',
    bg: 'rgba(20,184,166,0.07)',
    border: 'rgba(20,184,166,0.12)',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
      </svg>
    ),
    title: 'Digital Prescriptions',
    description: 'Secure e-prescriptions with QR verification sent directly to your pharmacy, reducing fraud and improving accuracy.',
    color: '#7c3aed',
    bg: 'rgba(124,58,237,0.07)',
    border: 'rgba(124,58,237,0.12)',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    title: 'Secure Authentication',
    description: 'Multi-factor authentication and biometric login protect your account with HIPAA-compliant security standards.',
    color: '#dc2626',
    bg: 'rgba(220,38,38,0.07)',
    border: 'rgba(220,38,38,0.12)',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
    title: 'Real-Time Communication',
    description: 'Instant messaging with read receipts, file sharing, and notification system for seamless doctor-patient communication.',
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.07)',
    border: 'rgba(245,158,11,0.12)',
  },
];

const containerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as any } },
};

const About: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <section id="about" className="relative py-24 overflow-hidden bg-white">
      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.02] pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(#2563eb 1px, transparent 1px), linear-gradient(90deg, #2563eb 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="section-badge mb-5 inline-flex">
            <span className="w-1.5 h-1.5 rounded-full bg-[#2563eb] animate-pulse" />
            Why Choose MediConnect
          </span>
          <h2 className="font-display font-700 text-4xl sm:text-5xl text-[#0f172a] mb-5">
            Everything You Need for{' '}
            <span className="text-gradient">Modern Healthcare</span>
          </h2>
          <p className="text-[#475569] text-lg max-w-2xl mx-auto leading-relaxed">
            Our comprehensive platform brings together all the tools patients and doctors need
            for a seamless, secure, and efficient healthcare experience.
          </p>
        </motion.div>

        {/* Feature Cards Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {FEATURES.map((feature, index) => (
            <motion.div
              key={feature.title}
              variants={cardVariants}
              whileHover={{ y: -6, transition: { duration: 0.3 } }}
              className="group relative p-6 rounded-2xl cursor-pointer transition-shadow duration-300"
              style={{
                background: 'rgba(255,255,255,0.9)',
                border: `1px solid ${feature.border}`,
                boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
              }}
            >
              {/* Hover glow */}
              <div
                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{
                  background: `radial-gradient(circle at 50% 0%, ${feature.bg} 0%, transparent 60%)`,
                }}
              />

              {/* Border animation on hover */}
              <div
                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                style={{ boxShadow: `0 0 0 1.5px ${feature.color}30, 0 8px 30px ${feature.color}15` }}
              />

              <div className="relative z-10">
                {/* Icon */}
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110"
                  style={{ background: feature.bg, color: feature.color }}
                >
                  {feature.icon}
                </div>

                {/* Content */}
                <h3 className="font-display font-700 text-lg text-[#0f172a] mb-2 group-hover:text-[#2563eb] transition-colors duration-300">
                  {feature.title}
                </h3>
                <p className="text-[#475569] text-sm leading-relaxed">
                  {feature.description}
                </p>

                {/* Learn more arrow */}
                <div className="flex items-center gap-1 mt-4 text-sm font-semibold opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-0 group-hover:translate-x-1"
                  style={{ color: feature.color }}>
                  <span>Learn more</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </div>
              </div>

              {/* Card number */}
              <div
                className="absolute top-5 right-5 text-2xl font-display font-800 opacity-[0.06] select-none"
                style={{ color: feature.color }}
              >
                {String(index + 1).padStart(2, '0')}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default About;
