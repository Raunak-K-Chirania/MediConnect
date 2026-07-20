import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';

const SERVICES = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-7 h-7">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    title: 'Online Consultation',
    description: 'Connect with certified specialists via HD video call. Get expert medical advice from the comfort of your home.',
    badge: 'Most Popular',
    color: '#2563eb',
    gradient: 'linear-gradient(135deg, #2563eb, #3b82f6)',
    features: ['HD Video Call', 'Chat Support', 'Follow-ups'],
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-7 h-7">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    ),
    title: 'Emergency Support',
    description: '24/7 emergency medical guidance with rapid response team and immediate connection to on-call specialists.',
    badge: '24/7 Available',
    color: '#dc2626',
    gradient: 'linear-gradient(135deg, #dc2626, #ef4444)',
    features: ['Rapid Response', 'On-Call Doctors', 'Ambulance Link'],
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-7 h-7">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
    title: 'Health Records',
    description: 'Unified digital health records with complete history, lab reports, imaging, and treatment plans in one place.',
    badge: 'Encrypted',
    color: '#14b8a6',
    gradient: 'linear-gradient(135deg, #14b8a6, #06b6d4)',
    features: ['Lab Results', 'Imaging', 'Prescriptions'],
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-7 h-7">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
    title: 'Prescription Management',
    description: 'Digital prescriptions with QR codes sent directly to certified pharmacies, with refill reminders and drug interactions check.',
    badge: 'Smart Refills',
    color: '#7c3aed',
    gradient: 'linear-gradient(135deg, #7c3aed, #8b5cf6)',
    features: ['E-Prescriptions', 'Pharmacy Link', 'Refill Alerts'],
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-7 h-7">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    title: 'Specialist Doctors',
    description: 'Access to 1,200+ verified specialists across 50+ medical fields, from cardiology to dermatology and beyond.',
    badge: '50+ Fields',
    color: '#f59e0b',
    gradient: 'linear-gradient(135deg, #f59e0b, #fbbf24)',
    features: ['Verified Experts', 'Multiple Fields', 'Global Network'],
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-7 h-7">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
    title: 'Follow-up Care',
    description: 'Automated follow-up scheduling, progress tracking, and wellness monitoring for continuous patient care.',
    badge: 'Automated',
    color: '#06b6d4',
    gradient: 'linear-gradient(135deg, #06b6d4, #0891b2)',
    features: ['Auto-Scheduling', 'Progress Tracking', 'Health Insights'],
  },
];

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 25 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

const Services: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <section id="services" className="relative py-24 overflow-hidden bg-gradient-section">
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute -top-20 -right-20 w-96 h-96 rounded-full blur-3xl opacity-20"
          style={{ background: 'radial-gradient(circle, rgba(37,99,235,0.3) 0%, transparent 70%)' }}
        />
        <div
          className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full blur-3xl opacity-15"
          style={{ background: 'radial-gradient(circle, rgba(20,184,166,0.3) 0%, transparent 70%)' }}
        />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="section-badge mb-5 inline-flex">
            <span className="w-1.5 h-1.5 rounded-full bg-[#14b8a6] animate-pulse" />
            Our Services
          </span>
          <h2 className="font-display font-700 text-4xl sm:text-5xl text-[#0f172a] mb-5">
            Comprehensive{' '}
            <span className="text-gradient">Healthcare Solutions</span>
          </h2>
          <p className="text-[#475569] text-lg max-w-2xl mx-auto leading-relaxed">
            From instant consultations to long-term wellness tracking, we provide every service
            you need for a complete healthcare journey.
          </p>
        </motion.div>

        {/* Services Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {SERVICES.map((service) => (
            <motion.div
              key={service.title}
              variants={cardVariants}
              whileHover={{ y: -6, transition: { duration: 0.25 } }}
              className="group relative p-6 rounded-2xl bg-white cursor-pointer overflow-hidden"
              style={{
                boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
                border: '1px solid rgba(0,0,0,0.06)',
              }}
            >
              {/* Top gradient bar */}
              <div
                className="absolute top-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ background: service.gradient }}
              />

              {/* Badge */}
              <div className="flex items-center justify-between mb-4">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-110"
                  style={{
                    background: `${service.color}12`,
                    color: service.color,
                  }}
                >
                  {service.icon}
                </div>
                <span
                  className="text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={{
                    background: `${service.color}12`,
                    color: service.color,
                  }}
                >
                  {service.badge}
                </span>
              </div>

              {/* Content */}
              <h3 className="font-display font-700 text-lg text-[#0f172a] mb-2 group-hover:text-[#2563eb] transition-colors duration-300">
                {service.title}
              </h3>
              <p className="text-[#475569] text-sm leading-relaxed mb-4">
                {service.description}
              </p>

              {/* Feature pills */}
              <div className="flex flex-wrap gap-2">
                {service.features.map((feat) => (
                  <span
                    key={feat}
                    className="text-xs px-2.5 py-1 rounded-full font-medium"
                    style={{
                      background: `${service.color}08`,
                      color: service.color,
                      border: `1px solid ${service.color}20`,
                    }}
                  >
                    {feat}
                  </span>
                ))}
              </div>

              {/* Hover background glow */}
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl"
                style={{
                  background: `radial-gradient(circle at 50% 100%, ${service.color}06 0%, transparent 60%)`,
                }}
              />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default Services;
