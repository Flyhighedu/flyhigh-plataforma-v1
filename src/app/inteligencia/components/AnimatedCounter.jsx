import React, { useEffect, useState, useRef } from 'react';

export default function AnimatedCounter({ value, duration = 400, className = '' }) {
  const [displayValue, setDisplayValue] = useState(value);
  const [isAnimating, setIsAnimating] = useState(false);
  
  useEffect(() => {
    if (value === displayValue) return;
    
    setIsAnimating(true);
    let startTimestamp = null;
    const startValue = displayValue;
    const endValue = value;
    
    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      
      // easeOutQuart
      const ease = 1 - Math.pow(1 - progress, 4);
      const current = Math.floor(startValue + (endValue - startValue) * ease);
      
      setDisplayValue(current);
      
      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        setDisplayValue(endValue);
        setTimeout(() => setIsAnimating(false), 150); // let the visual pop linger slightly
      }
    };
    
    window.requestAnimationFrame(step);
  }, [value, duration]); // Intentionally omitting displayValue

  return (
    <span 
      className={`inline-block transition-transform duration-150 ${isAnimating ? 'scale-125 text-white font-black drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]' : ''} ${className}`}
    >
      {displayValue.toLocaleString()}
    </span>
  );
}
