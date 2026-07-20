import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { useCountUp } from './hooks/useCountUp';

const STATS = [
  {
    end: 10000,
    suffix: '+',
    label: 'Happy Patients',
    subLabel: 'Across 30+ countries',
    icon: '👥',
    color: '#60a5fa',
  },
  {
    end: 1200,
    suffix: '+',
    label: 'Verified Doctors',
    subLabel: 'In 50+ specializations',
    icon: '👨‍⚕️',
    color: '#34d399',
  },
  {
    end: 50,
    suffix: '+',
    label: 'Partner Hospitals',
    subLabel: 'Top-rated healthcare centers',
    icon: '🏥',
    color: '#818cf8',
  },
  {
    end: 99.9,
    suffix: '%',
    label: 'Secure & Reliable',
    subLabel: 'HIPAA & GDPR compliant',
    icon: '🔒',
    decimals: 1,
    color: '#fbbf24',
  },
];

function StatCard({ stat, index }: { stat: typeof STATS[0]; index: number }) {
  const { value, ref } = useCountUp({
    end: stat.end,
    duration: 2200,
    suffix: stat.suffix,
    decimals: (stat as any).decimals ?? 0,
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: index * 0.15, ease: [0.22, 1, 0.36, 1] }}
      className="relative flex flex-col items-center text-center group"
    >
      {/* Separator line between stats (hidden on last) */}
      {index < STATS.length - 1 && (
        <div className="hidden lg:block absolute right-0 top-1/2 -translate-y-1/2 w-px h-16 bg-white/10" />
      )}

      {/* Icon */}
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mb-4 transition-transform duration-300 group-hover:scale-110"
        style={{ background: `${stat.color}20`, border: `1px solid ${stat.color}30` }}
      >
        {stat.icon}
      </div>

      {/* Count */}
      <motion.div
        ref={ref as React.RefObject<HTMLDivElement>}
        className="font-display font-800 text-5xl sm:text-6xl mb-2"
        style={{ color: stat.color, textShadow: `0 0 30px ${stat.color}40` }}
      >
        {value}
      </motion.div>

      {/* Labels */}
      <div className="text-white font-700 text-lg mb-1">{stat.label}</div>
      <div className="text-white/50 text-sm">{stat.subLabel}</div>
    </motion.div>
  );
}

const Statistics: React.FC = () => {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <section
      ref={ref}
      id="statistics"
      className="relative py-20 overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 40%, #164e63 70%, #0f172a 100%)',
      }}
    >
      {/* Stars / particles */}
      {Array.from({ length: 40 }).map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full opacity-30"
          style={{
            width: Math.random() * 3 + 1,
            height: Math.random() * 3 + 1,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            background: 'white',
            animation: `particleDrift ${Math.random() * 6 + 4}s ease-in-out ${Math.random() * 4}s infinite`,
          }}
        />
      ))}

      {/* Glow orbs */}
      <div
        className="absolute top-0 left-1/4 w-96 h-96 rounded-full blur-3xl opacity-20 pointer-events-none"
        style={{ background: 'radial-gradient(circle, #2563eb 0%, transparent 70%)' }}
      />
      <div
        className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full blur-3xl opacity-15 pointer-events-none"
        style={{ background: 'radial-gradient(circle, #06b6d4 0%, transparent 70%)' }}
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold mb-5"
            style={{ background: 'rgba(37,99,235,0.2)', color: '#93c5fd', border: '1px solid rgba(37,99,235,0.3)' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#60a5fa] animate-pulse" />
            Our Impact in Numbers
          </span>
          <h2 className="font-display font-700 text-4xl sm:text-5xl text-white">
            Trusted by Thousands{' '}
            <span style={{
              background: 'linear-gradient(135deg, #60a5fa, #34d399)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              Worldwide
            </span>
          </h2>
          <p className="text-white/60 text-lg mt-4 max-w-xl mx-auto">
            Real numbers that reflect our commitment to transforming global healthcare.
          </p>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-4">
          {STATS.map((stat, index) => (
            <StatCard key={stat.label} stat={stat} index={index} />
          ))}
        </div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.7 }}
          className="text-center mt-16"
        >
          <a
            href="/register"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-semibold text-[#0f172a] transition-all duration-300 hover:scale-105"
            style={{
              background: 'linear-gradient(135deg, #60a5fa, #34d399)',
              boxShadow: '0 4px 20px rgba(96,165,250,0.3)',
            }}
          >
            Join the Community
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </a>
        </motion.div>
      </div>
    </section>
  );
};

export default Statistics;
