import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence, useInView } from 'framer-motion';

const TESTIMONIALS = [
  {
    id: 1,
    name: 'Emily Rodriguez',
    role: 'Patient — Cardiology',
    avatar: 'ER',
    color: '#2563eb',
    bg: 'linear-gradient(135deg, #2563eb, #3b82f6)',
    rating: 5,
    quote:
      'MediConnect completely changed how I manage my heart condition. I can consult with Dr. Johnson from home, get my prescriptions instantly, and track my vitals — all in one app. The video quality is incredible!',
    date: 'June 2025',
    location: 'New York, USA',
  },
  {
    id: 2,
    name: 'Raj Mehta',
    role: 'Patient — Neurology',
    avatar: 'RM',
    color: '#14b8a6',
    bg: 'linear-gradient(135deg, #14b8a6, #06b6d4)',
    rating: 5,
    quote:
      "I was skeptical about telemedicine, but MediConnect proved me wrong. The platform is incredibly secure and the doctors are top-tier. I got a second opinion for my diagnosis without leaving Mumbai. Outstanding service!",
    date: 'May 2025',
    location: 'Mumbai, India',
  },
  {
    id: 3,
    name: 'Sophie Laurent',
    role: 'Patient — Dermatology',
    avatar: 'SL',
    color: '#7c3aed',
    bg: 'linear-gradient(135deg, #7c3aed, #8b5cf6)',
    rating: 5,
    quote:
      'As a working mother, finding time for doctor appointments was nearly impossible. MediConnect solved that. I booked a dermatology consult during my lunch break and had a prescription by evening. Revolutionary!',
    date: 'July 2025',
    location: 'Paris, France',
  },
  {
    id: 4,
    name: 'David Thompson',
    role: 'Patient — Psychiatry',
    avatar: 'DT',
    color: '#f59e0b',
    bg: 'linear-gradient(135deg, #f59e0b, #fbbf24)',
    rating: 5,
    quote:
      'Mental health care used to be hard to access where I live. MediConnect connected me with an excellent psychiatrist within 24 hours. The privacy features make me feel completely safe sharing sensitive information.',
    date: 'April 2025',
    location: 'Toronto, Canada',
  },
  {
    id: 5,
    name: 'Amara Osei',
    role: 'Patient — Pediatrics',
    avatar: 'AO',
    color: '#ec4899',
    bg: 'linear-gradient(135deg, #ec4899, #f472b6)',
    rating: 5,
    quote:
      "My daughter had a fever at 2 AM and I was panicking. MediConnect connected us with a pediatrician in minutes. The doctor was professional, calming, and prescribed the right medication. A true lifesaver!",
    date: 'March 2025',
    location: 'Accra, Ghana',
  },
];

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <svg key={s} className="w-4 h-4" fill={s <= rating ? '#fbbf24' : '#e5e7eb'} viewBox="0 0 24 24">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </div>
  );
}

const variants = {
  enter: (dir: number) => ({
    x: dir > 0 ? 120 : -120,
    opacity: 0,
    scale: 0.96,
  }),
  center: { x: 0, opacity: 1, scale: 1 },
  exit: (dir: number) => ({
    x: dir > 0 ? -120 : 120,
    opacity: 0,
    scale: 0.96,
  }),
};

const Testimonials: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });
  const [[active, direction], setActive] = useState([0, 0]);

  const paginate = (dir: number) => {
    setActive(([prev]) => [
      (prev + dir + TESTIMONIALS.length) % TESTIMONIALS.length,
      dir,
    ]);
  };

  // Auto-play
  useEffect(() => {
    const timer = setInterval(() => paginate(1), 6000);
    return () => clearInterval(timer);
  }, []);

  const testimonial = TESTIMONIALS[active];

  return (
    <section
      id="testimonials"
      className="relative py-24 overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #f8fbff 0%, #f0f9ff 100%)' }}
    >
      {/* Background blobs */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-0 left-0 w-80 h-80 rounded-full blur-3xl opacity-20"
          style={{ background: 'radial-gradient(circle, rgba(37,99,235,0.3) 0%, transparent 70%)' }}
        />
        <div
          className="absolute bottom-0 right-0 w-96 h-96 rounded-full blur-3xl opacity-15"
          style={{ background: 'radial-gradient(circle, rgba(20,184,166,0.3) 0%, transparent 70%)' }}
        />
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="section-badge mb-5 inline-flex">
            <span className="w-1.5 h-1.5 rounded-full bg-[#fbbf24] animate-pulse" />
            Patient Stories
          </span>
          <h2 className="font-display font-700 text-4xl sm:text-5xl text-[#0f172a] mb-4">
            What Our{' '}
            <span className="text-gradient">Patients Say</span>
          </h2>
          <p className="text-[#475569] text-lg max-w-xl mx-auto">
            Real stories from real patients who transformed their healthcare experience with MediConnect.
          </p>
        </motion.div>

        {/* Testimonial Slider */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="relative"
        >
          {/* Quote mark */}
          <div
            className="absolute -top-6 -left-2 text-9xl font-display font-800 leading-none opacity-[0.06] pointer-events-none select-none"
            style={{ color: '#2563eb' }}
          >
            "
          </div>

          {/* Slider */}
          <div
            className="relative overflow-hidden rounded-3xl"
            style={{ minHeight: '320px' }}
          >
            <AnimatePresence custom={direction} mode="wait">
              <motion.div
                key={active}
                custom={direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="relative p-8 sm:p-10 rounded-3xl bg-white"
                style={{
                  boxShadow: '0 8px 40px rgba(37,99,235,0.1), 0 2px 8px rgba(0,0,0,0.05)',
                  border: '1px solid rgba(37,99,235,0.08)',
                }}
              >
                {/* Top row */}
                <div className="flex flex-col sm:flex-row sm:items-start gap-5 mb-6">
                  {/* Avatar */}
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-display font-700 text-xl flex-shrink-0"
                    style={{ background: testimonial.bg }}
                  >
                    {testimonial.avatar}
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                      <div>
                        <h4 className="font-display font-700 text-[#0f172a] text-lg">{testimonial.name}</h4>
                        <p className="text-sm font-medium" style={{ color: testimonial.color }}>{testimonial.role}</p>
                      </div>
                      <div className="text-right">
                        <StarRating rating={testimonial.rating} />
                        <p className="text-xs text-[#94a3b8] mt-1">{testimonial.date} · {testimonial.location}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quote */}
                <blockquote className="text-[#475569] text-lg leading-relaxed italic">
                  "{testimonial.quote}"
                </blockquote>

                {/* Verified badge */}
                <div className="flex items-center gap-1.5 mt-6">
                  <svg className="w-4 h-4 text-[#14b8a6]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-xs font-semibold text-[#14b8a6]">Verified Patient Review</span>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between mt-8">
            {/* Dots */}
            <div className="flex gap-2">
              {TESTIMONIALS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActive([i, i > active ? 1 : -1])}
                  className="transition-all duration-300 rounded-full"
                  style={{
                    width: i === active ? '24px' : '8px',
                    height: '8px',
                    background: i === active ? '#2563eb' : '#cbd5e1',
                  }}
                  aria-label={`Go to testimonial ${i + 1}`}
                />
              ))}
            </div>

            {/* Arrow buttons */}
            <div className="flex gap-3">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => paginate(-1)}
                className="w-10 h-10 rounded-xl glass border border-[#2563eb]/15 flex items-center justify-center text-[#475569] hover:text-[#2563eb] transition-colors"
                aria-label="Previous testimonial"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => paginate(1)}
                className="w-10 h-10 rounded-xl bg-gradient-brand flex items-center justify-center text-white shadow-brand"
                aria-label="Next testimonial"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </motion.button>
            </div>
          </div>
        </motion.div>

        {/* Trust bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="flex flex-wrap justify-center items-center gap-8 mt-16 pt-10 border-t border-[#e2e8f0]"
        >
          {[
            { label: 'Average Rating', value: '4.9/5', icon: '⭐' },
            { label: 'Total Reviews', value: '12,000+', icon: '💬' },
            { label: 'Recommend Rate', value: '98%', icon: '👍' },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-3">
              <span className="text-2xl">{item.icon}</span>
              <div>
                <div className="font-display font-700 text-[#0f172a] text-xl">{item.value}</div>
                <div className="text-xs text-[#94a3b8] font-medium">{item.label}</div>
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default Testimonials;
