import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const NAV_LINKS = [
  { label: 'Home', href: '#home' },
  { label: 'About', href: '#about' },
  { label: 'Services', href: '#services' },
  { label: 'Doctors', href: '#doctors' },
  { label: 'Testimonials', href: '#testimonials' },
];

const Navbar: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('home');

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);

      const sections = ['home', 'about', 'services', 'doctors', 'testimonials'];
      for (const id of sections.reverse()) {
        const el = document.getElementById(id);
        if (el && window.scrollY >= el.offsetTop - 120) {
          setActiveSection(id);
          break;
        }
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleNavClick = useCallback((href: string) => {
    setMobileOpen(false);
    const id = href.replace('#', '');
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  }, []);

  return (
    <>
      <motion.nav
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolled
            ? 'glass shadow-[0_4px_30px_rgba(37,99,235,0.08)] py-3'
            : 'bg-transparent py-5'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <motion.a
              href="#home"
              onClick={(e) => { e.preventDefault(); handleNavClick('#home'); }}
              className="flex items-center gap-3 group"
              whileHover={{ scale: 1.02 }}
            >
              <div className="relative w-10 h-10 rounded-xl bg-gradient-brand flex items-center justify-center shadow-brand overflow-hidden">
                <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-white" stroke="currentColor" strokeWidth={2.5}>
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
                  <path d="M12 8v4M12 16v.01M8 12h4M16 12h.01" strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>
              <div>
                <span className="font-display font-800 text-xl text-[#0f172a] tracking-tight">
                  Medi<span className="text-gradient">Connect</span>
                </span>
              </div>
            </motion.a>

            {/* Desktop Links */}
            <div className="hidden md:flex items-center gap-1">
              {NAV_LINKS.map((link) => (
                <motion.button
                  key={link.href}
                  onClick={() => handleNavClick(link.href)}
                  className={`relative px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 cursor-pointer ${
                    activeSection === link.href.replace('#', '')
                      ? 'text-[#2563eb]'
                      : 'text-[#475569] hover:text-[#0f172a]'
                  }`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                >
                  {activeSection === link.href.replace('#', '') && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute inset-0 bg-[#2563eb]/08 rounded-xl"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10">{link.label}</span>
                </motion.button>
              ))}
            </div>

            {/* CTA + Mobile Toggle */}
            <div className="flex items-center gap-3">
              <motion.a
                href="/login"
                className="hidden sm:inline-flex text-sm font-semibold text-[#475569] hover:text-[#0f172a] transition-colors"
                whileHover={{ scale: 1.02 }}
              >
                Sign In
              </motion.a>
              <motion.a
                href="/register"
                className="btn-primary !py-2.5 !px-5 !text-sm shadow-brand"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                Get Started
              </motion.a>
              {/* Mobile Hamburger */}
              <button
                className="md:hidden relative w-10 h-10 rounded-xl glass flex items-center justify-center"
                onClick={() => setMobileOpen(!mobileOpen)}
                aria-label="Toggle menu"
              >
                <span
                  className={`absolute block w-5 h-0.5 bg-[#0f172a] transition-all duration-300 ${mobileOpen ? 'rotate-45 translate-y-0' : '-translate-y-1.5'}`}
                />
                <span
                  className={`absolute block w-5 h-0.5 bg-[#0f172a] transition-all duration-300 ${mobileOpen ? 'opacity-0' : 'opacity-100'}`}
                />
                <span
                  className={`absolute block w-5 h-0.5 bg-[#0f172a] transition-all duration-300 ${mobileOpen ? '-rotate-45 translate-y-0' : 'translate-y-1.5'}`}
                />
              </button>
            </div>
          </div>
        </div>
      </motion.nav>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed top-0 right-0 bottom-0 w-72 bg-white z-50 shadow-2xl md:hidden flex flex-col"
            >
              <div className="p-6 flex items-center justify-between border-b border-gray-100">
                <span className="font-display font-700 text-lg text-[#0f172a]">
                  Medi<span className="text-gradient">Connect</span>
                </span>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="w-8 h-8 rounded-lg glass flex items-center justify-center text-[#475569]"
                >
                  ✕
                </button>
              </div>
              <nav className="flex-1 p-6 flex flex-col gap-2">
                {NAV_LINKS.map((link, i) => (
                  <motion.button
                    key={link.href}
                    initial={{ x: 40, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: i * 0.06 }}
                    onClick={() => handleNavClick(link.href)}
                    className="text-left px-4 py-3 rounded-xl text-[#475569] font-semibold hover:bg-[#f8fbff] hover:text-[#2563eb] transition-all cursor-pointer"
                  >
                    {link.label}
                  </motion.button>
                ))}
              </nav>
              <div className="p-6 border-t border-gray-100 flex flex-col gap-3">
                <a href="/login" className="btn-secondary text-center">Sign In</a>
                <a href="/register" className="btn-primary text-center shadow-brand">Get Started</a>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default Navbar;
