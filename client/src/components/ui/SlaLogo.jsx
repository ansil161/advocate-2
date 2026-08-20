import React from 'react';

export default function SlaLogo({ className = '', size = 'md', variant = 'gold' }) {
  // Size presets
  const sizeMap = {
    sm: { height: '38px', iconSize: '30px' },
    md: { height: '54px', iconSize: '46px' },
    lg: { height: '72px', iconSize: '60px' },
    xl: { height: '96px', iconSize: '84px' },
  };


  const currentSize = sizeMap[size] || sizeMap.md;

  return (
    <div className={`sla-logo-brand sla-logo-brand--${variant} ${className}`} style={{ height: currentSize.height }}>
      <svg
        viewBox="0 0 180 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="sla-logo-svg"
        style={{ height: '100%', width: 'auto' }}
        aria-label="SLA Advocates Logo"
      >
        <defs>
          {/* Metallic Gold Gradient */}
          <linearGradient id="slaGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F5E0B3" />
            <stop offset="35%" stopColor="#D4AF37" />
            <stop offset="70%" stopColor="#AA7C11" />
            <stop offset="100%" stopColor="#E6CA65" />
          </linearGradient>

          {/* Deep Navy/Obsidian Gradient */}
          <linearGradient id="slaNavyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2B3E6B" />
            <stop offset="50%" stopColor="#1B2845" />
            <stop offset="100%" stopColor="#0F172A" />
          </linearGradient>

          {/* Soft Glow */}
          <filter id="goldGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* 1. SCALES OF JUSTICE EMBLEM (TOP OF L) */}
        <g stroke="url(#slaGoldGrad)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none">
          {/* Main Stem */}
          <path d="M 90,6 L 90,26" />
          {/* Top Beam */}
          <path d="M 68,14 C 78,11 102,11 112,14" />
          {/* Left Pan Chains & Pan */}
          <path d="M 68,14 L 62,23 M 68,14 L 74,23" />
          <path d="M 60,23 C 60,27 76,27 76,23 Z" fill="url(#slaGoldGrad)" fillOpacity="0.25" />
          {/* Right Pan Chains & Pan */}
          <path d="M 112,14 L 106,23 M 112,14 L 118,23" />
          <path d="M 104,23 C 104,27 120,27 120,23 Z" fill="url(#slaGoldGrad)" fillOpacity="0.25" />
          {/* Top Finial */}
          <circle cx="90" cy="5" r="1.5" fill="url(#slaGoldGrad)" />
        </g>

        {/* 2. INTERLOCKING "S", "L", "A" MONOGRAM */}
        {/* Letter "S" (Serif Gold Flowing Loop) */}
        <path
          d="M 72,36 C 58,35 48,44 48,56 C 48,72 78,68 78,84 C 78,96 62,102 46,95 C 40,92 35,86 34,78"
          stroke="url(#slaGoldGrad)"
          strokeWidth="6.5"
          strokeLinecap="round"
          fill="none"
          filter="url(#goldGlow)"
        />
        {/* Swash Tail of S */}
        <circle cx="34" cy="78" r="2" fill="url(#slaGoldGrad)" />

        {/* Letter "L" (Navy/Cream Serif Stem overlapping S) */}
        <path
          d="M 90,24 L 90,82 C 90,83 95,84 118,84"
          stroke={variant === 'light' ? '#0F172A' : '#F7F4EC'}
          strokeWidth="7"
          strokeLinecap="square"
          strokeLinejoin="miter"
          fill="none"
        />
        {/* L Top Serif */}
        <path d="M 84,24 L 96,24" stroke={variant === 'light' ? '#0F172A' : '#F7F4EC'} strokeWidth="2.5" />
        {/* L Bottom Serif */}
        <path d="M 118,80 L 118,88" stroke={variant === 'light' ? '#0F172A' : '#F7F4EC'} strokeWidth="2.5" />

        {/* Letter "A" (Serif Gold Peak) */}
        <path
          d="M 104,84 L 126,45 L 148,84 M 111,72 L 141,72"
          stroke="url(#slaGoldGrad)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />

        {/* 3. "ADVOCATES" TEXT (CAPS SANS-SERIF) */}
        <text
          x="90"
          y="108"
          textAnchor="middle"
          fill={variant === 'light' ? '#0F172A' : '#F7F4EC'}
          fontFamily="Inter, var(--font-sans), sans-serif"
          fontSize="12"
          fontWeight="600"
          letterSpacing="0.32em"
        >
          ADVOCATES
        </text>
      </svg>
    </div>
  );
}
