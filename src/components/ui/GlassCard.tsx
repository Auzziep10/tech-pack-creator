import React from 'react';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: 'default' | 'subtle' | 'glow';
}

export function GlassCard({ children, className = '', variant = 'default', ...props }: GlassCardProps) {
  const variants = {
    default: "bg-[#1A1A1A]/80 border-white/10",
    subtle: "bg-white/[0.02] border-white/[0.05]",
    glow: "bg-[#1A1A1A]/90 border-blue-500/20 shadow-[0_0_30px_rgba(37,99,235,0.05)]"
  };

  return (
    <div 
      className={`backdrop-blur-xl border rounded-2xl overflow-hidden ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
