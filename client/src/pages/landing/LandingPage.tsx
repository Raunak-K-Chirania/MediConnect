import React, { useEffect } from 'react';
import Navbar from '../../components/landing/Navbar';
import Hero from '../../components/landing/Hero';
import VideoSection from '../../components/landing/VideoSection';
import About from '../../components/landing/About';
import Statistics from '../../components/landing/Statistics';
import Services from '../../components/landing/Services';
import Doctors from '../../components/landing/Doctors';
import Testimonials from '../../components/landing/Testimonials';
import CTA from '../../components/landing/CTA';
import Footer from '../../components/landing/Footer';

const LandingPage: React.FC = () => {
  // Override body background for landing page (existing pages use dark bg)
  useEffect(() => {
    const originalBg = document.body.style.background;
    const originalColor = document.body.style.color;
    const originalClass = document.body.className;

    document.body.style.background = '#ffffff';
    document.body.style.color = '#0f172a';
    document.body.className = '';

    return () => {
      document.body.style.background = originalBg;
      document.body.style.color = originalColor;
      document.body.className = originalClass;
    };
  }, []);

  return (
    <>
      {/* Skip navigation for accessibility */}
      <a
        href="#home"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-[#2563eb] focus:text-white focus:rounded-xl focus:font-semibold"
      >
        Skip to main content
      </a>

      <Navbar />

      <main>
        <Hero />
        <VideoSection />
        <About />
        <Statistics />
        <Services />
        <Doctors />
        <Testimonials />
        <CTA />
      </main>

      <Footer />
    </>
  );
};

export default LandingPage;
