import React, { useRef, useState } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';

const DOCTORS = [
  {
    id: 1,
    name: 'Dr. Sarah Johnson',
    specialization: 'Cardiologist',
    experience: '15 years',
    rating: 4.9,
    reviews: 312,
    availability: 'Available Today',
    avatar: 'SJ',
    color: '#2563eb',
    bg: 'linear-gradient(135deg, #2563eb, #3b82f6)',
    badge: '⭐ Top Rated',
  },
  {
    id: 2,
    name: 'Dr. Michael Chen',
    specialization: 'Neurologist',
    experience: '12 years',
    rating: 4.8,
    reviews: 248,
    availability: 'Available Tomorrow',
    avatar: 'MC',
    color: '#14b8a6',
    bg: 'linear-gradient(135deg, #14b8a6, #06b6d4)',
    badge: '🏆 Expert',
  },
  {
    id: 3,
    name: 'Dr. Priya Patel',
    specialization: 'Dermatologist',
    experience: '10 years',
    rating: 4.9,
    reviews: 196,
    availability: 'Available Today',
    avatar: 'PP',
    color: '#7c3aed',
    bg: 'linear-gradient(135deg, #7c3aed, #8b5cf6)',
    badge: '⭐ Top Rated',
  },
  {
    id: 4,
    name: 'Dr. James Wilson',
    specialization: 'Orthopedic Surgeon',
    experience: '18 years',
    rating: 4.7,
    reviews: 421,
    availability: 'Available Today',
    avatar: 'JW',
    color: '#f59e0b',
    bg: 'linear-gradient(135deg, #f59e0b, #fbbf24)',
    badge: '🏆 Senior',
  },
  {
    id: 5,
    name: 'Dr. Aisha Rahman',
    specialization: 'Pediatrician',
    experience: '8 years',
    rating: 4.9,
    reviews: 187,
    availability: 'Available Today',
    avatar: 'AR',
    color: '#ec4899',
    bg: 'linear-gradient(135deg, #ec4899, #f472b6)',
    badge: '⭐ Rising Star',
  },
  {
    id: 6,
    name: 'Dr. Robert Kim',
    specialization: 'Psychiatrist',
    experience: '14 years',
    rating: 4.8,
    reviews: 263,
    availability: 'Available Tomorrow',
    avatar: 'RK',
    color: '#06b6d4',
    bg: 'linear-gradient(135deg, #06b6d4, #0891b2)',
    badge: '🏆 Expert',
  },
];

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className="w-4 h-4"
          fill={star <= Math.floor(rating) ? '#fbbf24' : star - 0.5 <= rating ? '#fbbf24' : '#e5e7eb'}
          viewBox="0 0 24 24"
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </div>
  );
}

function DoctorCard({ doctor }: { doctor: typeof DOCTORS[0] }) {
  return (
    <motion.div
      whileHover={{ y: -6, transition: { duration: 0.25 } }}
      className="group flex-shrink-0 w-72 rounded-2xl bg-white overflow-hidden cursor-pointer"
      style={{
        boxShadow: '0 4px 20px rgba(0,0,0,0.07)',
        border: '1px solid rgba(0,0,0,0.06)',
      }}
    >
      {/* Card top with avatar */}
      <div
        className="relative h-32 flex items-center justify-center overflow-hidden"
        style={{ background: doctor.bg }}
      >
        {/* Pattern */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.3) 0%, transparent 40%), radial-gradient(circle at 80% 80%, rgba(255,255,255,0.2) 0%, transparent 40%)',
          }}
        />
        {/* Avatar */}
        <div className="relative z-10 w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-sm border-2 border-white/40 flex items-center justify-center">
          <span className="text-white font-display font-800 text-2xl">{doctor.avatar}</span>
        </div>
        {/* Badge */}
        <div className="absolute top-3 right-3 text-xs font-semibold px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-sm text-white border border-white/30">
          {doctor.badge}
        </div>
        {/* Availability dot */}
        <div
          className="absolute bottom-3 left-3 flex items-center gap-1.5 text-xs font-medium text-white"
          style={{ background: 'rgba(0,0,0,0.2)', padding: '4px 10px', borderRadius: '100px' }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#4ade80] animate-pulse" />
          {doctor.availability}
        </div>
      </div>

      {/* Card Body */}
      <div className="p-5">
        <h3 className="font-display font-700 text-[#0f172a] text-lg mb-0.5">{doctor.name}</h3>
        <p className="text-sm font-semibold mb-3" style={{ color: doctor.color }}>
          {doctor.specialization}
        </p>

        {/* Rating + Experience */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <StarRating rating={doctor.rating} />
            <span className="text-sm font-semibold text-[#0f172a]">{doctor.rating}</span>
            <span className="text-xs text-[#94a3b8]">({doctor.reviews})</span>
          </div>
        </div>

        <div className="flex items-center gap-4 mb-5 text-sm text-[#475569]">
          <div className="flex items-center gap-1.5">
            <svg className="w-4 h-4 text-[#94a3b8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{doctor.experience} exp.</span>
          </div>
        </div>

        {/* Book Button */}
        <motion.a
          href="/register"
          whileTap={{ scale: 0.97 }}
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl font-semibold text-sm text-white transition-all duration-300 group-hover:shadow-lg"
          style={{
            background: doctor.bg,
            boxShadow: `0 4px 12px ${doctor.color}30`,
          }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Book Appointment
        </motion.a>
      </div>
    </motion.div>
  );
}

const Doctors: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });
  const [currentPage, setCurrentPage] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const amount = 300;
    scrollRef.current.scrollBy({ left: dir === 'right' ? amount : -amount, behavior: 'smooth' });
  };

  return (
    <section id="doctors" className="relative py-24 overflow-hidden bg-white">
      {/* Background */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          backgroundImage: 'radial-gradient(circle at 10% 50%, rgba(37,99,235,0.04) 0%, transparent 50%), radial-gradient(circle at 90% 50%, rgba(20,184,166,0.04) 0%, transparent 50%)',
        }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-12"
        >
          <div>
            <span className="section-badge mb-4 inline-flex">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2563eb] animate-pulse" />
              Our Medical Team
            </span>
            <h2 className="font-display font-700 text-4xl sm:text-5xl text-[#0f172a] mt-2">
              Meet Our{' '}
              <span className="text-gradient">Top Specialists</span>
            </h2>
            <p className="text-[#475569] text-lg mt-3 max-w-xl">
              Board-certified doctors with decades of combined experience, ready to provide world-class care.
            </p>
          </div>

          {/* Navigation arrows */}
          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => scroll('left')}
              className="w-11 h-11 rounded-xl glass border border-[#2563eb]/15 flex items-center justify-center text-[#475569] hover:text-[#2563eb] hover:border-[#2563eb]/30 transition-all duration-300"
              aria-label="Scroll left"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => scroll('right')}
              className="w-11 h-11 rounded-xl bg-gradient-brand flex items-center justify-center text-white shadow-brand"
              aria-label="Scroll right"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </motion.button>
          </div>
        </motion.div>

        {/* Scrollable carousel */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="relative"
        >
          {/* Fade edge masks */}
          <div className="absolute left-0 top-0 bottom-4 w-8 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-4 w-8 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />

          <div
            ref={scrollRef}
            className="flex gap-5 overflow-x-auto pb-4 scrollbar-hide"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {DOCTORS.map((doctor, i) => (
              <motion.div
                key={doctor.id}
                initial={{ opacity: 0, x: 30 }}
                animate={isInView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.5, delay: i * 0.1 }}
              >
                <DoctorCard doctor={doctor} />
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* View All Button */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="text-center mt-10"
        >
          <a href="/register" className="btn-secondary inline-flex">
            View All Doctors
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </a>
        </motion.div>
      </div>
    </section>
  );
};

export default Doctors;
