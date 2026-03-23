import React from 'react';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: 'default' | 'subtle' | 'glow';
}

export function GlassCard({ children, className = '', variant = 'default', ...props }: GlassCardProps) {
  const variants = {
    default: "bg-white border-gray-200 shadow-sm",
    subtle: "bg-gray-50 border-gray-100",
    glow: "bg-white border-blue-100 shadow-[0_0_20px_rgba(59,130,246,0.1)]"
  };

  return (
    <div 
      className={`border rounded-2xl overflow-hidden ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
