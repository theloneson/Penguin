import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

interface SplashScreenProps {
  onFinish: () => void;
}

export default function SplashScreen({ onFinish }: SplashScreenProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [videoError, setVideoError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Show splash for 6 seconds then fade out
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onFinish, 1500); // Wait for 1.5s fade-out to finish
    }, 6000);

    return () => clearTimeout(timer);
  }, [onFinish]);

  // Check if video can play
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play().catch((error) => {
        console.log('Video play failed:', error);
        setVideoError(true);
      });
    }
  }, []);

  if (!isVisible) return null;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1.5 }} // 1.5 second fade-out
    >
      {videoError ? (
        // Fallback - only show if video fails
        <div className="flex items-center justify-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-white text-6xl font-bold"
          >
            Penguin
          </motion.div>
        </div>
      ) : (
        // Video - this should be the main content
        <video 
          ref={videoRef}
          autoPlay 
          muted 
          playsInline
          onError={() => setVideoError(true)}
          onLoadedData={() => console.log('Video loaded successfully')}
          className="w-full h-full object-cover"
        >
          <source src="/penguin.mp4" type="video/mp4" />
          <source src="/penguin.mov" type="video/quicktime" />
          <source src="/penguin.webm" type="video/webm" />
          Your browser does not support the video tag.
        </video>
      )}
    </motion.div>
  );
}