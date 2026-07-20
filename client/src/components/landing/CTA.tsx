import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';

const CTA: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <section id="cta" className="relative py-24 overflow-hidden">
      {/* Gradient background */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 30%, #0369a1 60%, #0e7490 100%)',
        }}
      />

      {/* Animated mesh grid */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Glow orbs */}
      <div
        className="absolute top-0 left-1/4 w-96 h-96 rounded-full blur-3xl opacity-30 pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(96,165,250,0.5) 0%, transparent 70%)' }}
      />
      <div
        className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full blur-3xl opacity-25 pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(52,211,153,0.4) 0%, transparent 70%)' }}
      />

      {/* Floating particles */}
      {Array.from({ length: 15 }).map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full opacity-20"
          style={{
            width: Math.random() * 6 + 2,
            height: Math.random() * 6 + 2,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            background: 'white',
            animation: `float ${Math.random() * 6 + 4}s ease-in-out ${Math.random() * 4}s infinite`,
          }}
        />
      ))}

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col items-center gap-6"
        >
          {/* Badge */}
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold"
            style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.25)' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#34d399] animate-pulse" />
            Join 10,000+ Patients — Start Free Today
          </div>

          {/* Headline */}
          <h2
            className="font-display font-800 text-4xl sm:text-5xl lg:text-6xl text-white leading-[1.05] max-w-4xl"
          >
            Your Health Journey{' '}
            <span
              style={{
                background: 'linear-gradient(135deg, #93c5fd, #34d399)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Starts Now
            </span>
          </h2>

          {/* Sub-text */}
          <p className="text-white/75 text-lg max-w-2xl leading-relaxed">
            Sign up in 60 seconds and get access to 1,200+ certified doctors, instant prescriptions,
            and a complete suite of digital health tools — completely free to start.
          </p>

          {/* Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-4 mt-2">
            <motion.a
              href="/register"
              whileHover={{ scale: 1.03, boxShadow: '0 8px 30px rgba(255,255,255,0.3)' }}
              whileTap={{ scale: 0.97 }}
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-700 text-[#1e3a8a] text-base transition-all duration-300"
              style={{
                background: 'linear-gradient(135deg, #ffffff, #e0f2fe)',
                boxShadow: '0 4px 20px rgba(255,255,255,0.2)',
              }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Create Free Account
            </motion.a>
            <motion.a
              href="#doctors"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById('doctors')?.scrollIntoView({ behavior: 'smooth' });
              }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-700 text-white text-base transition-all duration-300"
              style={{
                background: 'rgba(255,255,255,0.12)',
                border: '1.5px solid rgba(255,255,255,0.3)',
              }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Book a Consultation
            </motion.a>
          </div>

          {/* Features beneath buttons */}
          <div className="flex flex-wrap justify-center gap-6 mt-4">
            {[
              '✓ No credit card required',
              '✓ Cancel anytime',
              '✓ HIPAA compliant',
              '✓ 24/7 support',
            ].map((text) => (
              <span key={text} className="text-sm text-white/70 font-medium">
                {text}
              </span>
            ))}
          </div>
        </motion.div>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="flex flex-wrap justify-center gap-8 mt-14 pt-10 border-t border-white/15"
        >
          {[
            { value: '< 2 min', label: 'Avg. Wait Time' },
            { value: '50+', label: 'Specializations' },
            { value: '4.9★', label: 'App Rating' },
            { value: '99.9%', label: 'Uptime SLA' },
          ].map((item) => (
            <div key={item.label} className="text-center">
              <div className="font-display font-800 text-white text-2xl">{item.value}</div>
              <div className="text-white/50 text-sm mt-0.5">{item.label}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default CTA;
