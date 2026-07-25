import React from 'react';

/**
 * Shared SVG icon set — iteration 11.2.
 *
 * Kept tiny and monochrome (`currentColor`) so each caller controls
 * color via Tailwind class. All icons are 16x16 stroke-based line
 * icons, matching the JetBrains/GitHub-Desktop convention.
 */
type IconProps = { className?: string };

const base = 'w-3.5 h-3.5';

export const CardIcon = {
  monitoring: (p: IconProps = {}) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={`${base} ${p.className || ''}`}>
      <path d="M3 3v18h18" /><path d="M7 15l4-4 3 3 5-6" />
    </svg>
  ),
  system: (p: IconProps = {}) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={`${base} ${p.className || ''}`}>
      <rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" />
    </svg>
  ),
  export: (p: IconProps = {}) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={`${base} ${p.className || ''}`}>
      <path d="M12 3v12M8 7l4-4 4 4" /><path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />
    </svg>
  ),
  sqlite: (p: IconProps = {}) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={`${base} ${p.className || ''}`}>
      <ellipse cx="12" cy="5" rx="8" ry="2.5" /><path d="M4 5v6c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5V5" /><path d="M4 11v6c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5v-6" />
    </svg>
  ),
  google: (p: IconProps = {}) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={`${base} ${p.className || ''}`}>
      <rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" />
    </svg>
  ),
  timeline: (p: IconProps = {}) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={`${base} ${p.className || ''}`}>
      <circle cx="6" cy="6" r="2" /><circle cx="6" cy="18" r="2" /><path d="M6 8v8M10 6h10M10 18h10" />
    </svg>
  ),
  log: (p: IconProps = {}) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={`${base} ${p.className || ''}`}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h8M8 9h2" />
    </svg>
  ),
  filter: (p: IconProps = {}) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={`${base} ${p.className || ''}`}>
      <path d="M4 5h16l-6 8v6l-4-2v-4L4 5z" />
    </svg>
  ),
  wrench: (p: IconProps = {}) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={`${base} ${p.className || ''}`}>
      <path d="M14.7 6.3a4 4 0 0 0 5 5l-8 8a2.8 2.8 0 0 1-4-4l7-7z" /><path d="M14.7 6.3l3 3" />
    </svg>
  ),
};

/** Timeline event icons — 12 px, currentColor. */
export const EventIcon = {
  start: (p: IconProps = {}) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={`w-3 h-3 ${p.className || ''}`}>
      <path d="M8 5v14l11-7z" />
    </svg>
  ),
  stop: (p: IconProps = {}) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={`w-3 h-3 ${p.className || ''}`}>
      <rect x="6" y="6" width="12" height="12" rx="1.5" />
    </svg>
  ),
  applying: (p: IconProps = {}) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={`w-3 h-3 ${p.className || ''}`}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  ),
  applied: (p: IconProps = {}) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className={`w-3 h-3 ${p.className || ''}`}>
      <path d="M5 12l4 4L19 7" />
    </svg>
  ),
  unavailable: (p: IconProps = {}) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className={`w-3 h-3 ${p.className || ''}`}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  ),
  cycle: (p: IconProps = {}) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={`w-3 h-3 ${p.className || ''}`}>
      <path d="M4 12a8 8 0 0 1 14-5" /><path d="M4 4v3h3" /><path d="M20 12a8 8 0 0 1-14 5" /><path d="M20 20v-3h-3" />
    </svg>
  ),
  export: (p: IconProps = {}) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={`w-3 h-3 ${p.className || ''}`}>
      <path d="M12 3v12M7 8l5-5 5 5" /><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  ),
  error: (p: IconProps = {}) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={`w-3 h-3 ${p.className || ''}`}>
      <path d="M12 3l10 18H2L12 3z" /><path d="M12 10v4M12 18h.01" />
    </svg>
  ),
};
