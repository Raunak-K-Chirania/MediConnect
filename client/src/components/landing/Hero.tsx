import React, { Suspense, lazy, useEffect, useRef } from 'react';
import { motion, type Variants } from 'framer-motion';

const Hero3D = lazy(() => import('./Hero3D'));

const PARTICLES = Array.from({ length: 20 }, (_, i) => ({
  id: i,
  size: Math.random() * 6 + 3,
  x: Math.random() * 100,
  y: Math.random() * 100,
  duration: Math.random() * 8 + 6,
  delay: Math.random() * 4,
  opacity: Math.random() * 0.4 + 0.1,
}));

const FLOATING_ICONS = [
  { icon: '🫀', label: 'Heart', x: '8%', y: '20%', delay: 0 },
  { icon: '🧬', label: 'DNA', x: '85%', y: '15%', delay: 1.5 },
  { icon: '💊', label: 'Medicine', x: '5%', y: '65%', delay: 0.8 },
  { icon: '🩺', label: 'Stethoscope', x: '90%', y: '70%', delay: 2.2 },
  { icon: '🔬', label: 'Microscope', x: '15%', y: '85%', delay: 1.2 },
  { icon: '🏥', label: 'Hospital', x: '80%', y: '85%', delay: 0.5 },
];

const containerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.15 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as any } },
};

const Hero: React.FC = () => {
  const scrollIndicatorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (scrollIndicatorRef.current) {
        scrollIndicatorRef.current.style.opacity = window.scrollY > 100 ? '0' : '1';
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <section
      id="home"
      className="relative min-h-screen flex items-center overflow-hidden bg-gradient-hero"
      style={{ paddingTop: '80px' }}
    >
      {/* Animated background particles */}
      {PARTICLES.map((p) => (
        <div
          key={p.id}
          className="particle"
          style={{
            width: p.size,
            height: p.size,
            left: `${p.x}%`,
            top: `${p.y}%`,
            background: `radial-gradient(circle, rgba(37,99,235,${p.opacity}) 0%, rgba(6,182,212,${p.opacity * 0.5}) 100%)`,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}

      {/* Floating medical icons */}
      {FLOATING_ICONS.map((icon) => (
        <motion.div
          key={icon.label}
          className="absolute hidden lg:flex items-center justify-center w-14 h-14 rounded-2xl glass shadow-card pointer-events-none select-none"
          style={{ left: icon.x, top: icon.y }}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{
            opacity: [0.7, 1, 0.7],
            y: [0, -12, 0],
            scale: [1, 1.05, 1],
          }}
          transition={{
            duration: 5,
            delay: icon.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          aria-label={icon.label}
        >
          <span className="text-2xl" role="img" aria-label={icon.label}>{icon.icon}</span>
        </motion.div>
      ))}

      {/* Background radial glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(37,99,235,0.08) 0%, transparent 70%)' }}
        />
        <div
          className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(6,182,212,0.08) 0%, transparent 70%)' }}
        />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="flex flex-col gap-6 lg:gap-7"
          >
            {/* Badge */}
            <motion.div variants={itemVariants}>
              <span className="section-badge">
                <span className="w-1.5 h-1.5 rounded-full bg-[#14b8a6] animate-pulse" />
                Trusted by 10,000+ Patients Worldwide
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              variants={itemVariants}
              className="font-display font-800 text-5xl sm:text-6xl lg:text-7xl text-[#0f172a] leading-[1.05] tracking-tight"
            >
              Healthcare{' '}
              <span className="block text-gradient">Without</span>
              Boundaries
            </motion.h1>

            {/* Subheading */}
            <motion.p
              variants={itemVariants}
              className="text-[#475569] text-lg leading-relaxed max-w-lg"
            >
              Connect with trusted doctors through{' '}
              <strong className="text-[#2563eb] font-semibold">secure video consultations</strong>,
              digital prescriptions, smart appointment scheduling, and
              encrypted medical records — all in one platform.
            </motion.p>

            {/* Buttons */}
            <motion.div variants={itemVariants} className="flex flex-wrap gap-4">
              <a href="/register" className="btn-primary shadow-brand text-base px-7 py-4">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
                Get Started Free
              </a>
              <button
                className="btn-secondary text-base px-7 py-4"
                onClick={() => {
                  const el = document.getElementById('doctors');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Book Appointment
              </button>
            </motion.div>

            {/* Trust Indicators */}
            <motion.div variants={itemVariants} className="flex flex-wrap items-center gap-6 pt-2">
              {[
                { label: 'HIPAA Compliant', icon: '🔒' },
                { label: 'Available 24/7', icon: '⏰' },
                { label: 'Verified Doctors', icon: '✅' },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2 text-sm text-[#475569]">
                  <span>{item.icon}</span>
                  <span className="font-medium">{item.label}</span>
                </div>
              ))}
            </motion.div>
          </motion.div>

          {/* Right — 3D Scene */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, x: 40 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            transition={{ duration: 0.9, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full aspect-square max-w-xl mx-auto lg:mx-0"
          >
            {/* Glowing ring backdrop */}
            <div
              className="absolute inset-4 rounded-full blur-2xl opacity-30"
              style={{ background: 'radial-gradient(circle, rgba(37,99,235,0.5) 0%, rgba(6,182,212,0.3) 50%, transparent 70%)' }}
            />
            <Suspense
              fallback={
                <div className="w-full h-full flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full border-4 border-[#2563eb]/30 border-t-[#2563eb] animate-spin" />
                </div>
              }
            >
              <Hero3D />
            </Suspense>
          </motion.div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div
        ref={scrollIndicatorRef}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 transition-opacity duration-500 cursor-pointer"
        onClick={() => {
          const el = document.getElementById('video');
          el?.scrollIntoView({ behavior: 'smooth' });
        }}
      >
        <span className="text-xs font-medium text-[#94a3b8] tracking-widest uppercase">Scroll</span>
        <div className="flex flex-col gap-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-1 h-1 rounded-full bg-[#2563eb]"
              style={{ animation: `bounceDown 1.5s ease-in-out ${i * 0.2}s infinite` }}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default Hero;
