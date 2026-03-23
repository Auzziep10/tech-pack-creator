import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'glass' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'primary', size = 'md', isLoading, children, ...props }, ref) => {
    
    const baseStyles = "relative inline-flex items-center justify-center font-medium transition-all duration-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#111] overflow-hidden group";
    
    const variants = {
      primary: "bg-black text-white hover:bg-gray-800 shadow-md",
      secondary: "bg-white text-gray-900 border border-gray-200 hover:bg-gray-50 hover:border-gray-300 shadow-sm",
      ghost: "bg-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100",
      glass: "bg-white/80 backdrop-blur-md text-gray-900 border border-gray-200 hover:bg-white/90 shadow-sm",
      danger: "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
    };

    const sizes = {
      sm: "px-3 py-1.5 text-sm",
      md: "px-4 py-2 text-sm",
      lg: "px-6 py-3 text-base"
    };

    return (
      <motion.button
        ref={ref}
        whileTap={{ scale: 0.98 }}
        className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className} ${isLoading || props.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        disabled={isLoading || props.disabled}
        {...(props as HTMLMotionProps<"button">)}
      >
        {/* Shimmer effect for primary button */}
        {variant === 'primary' && !props.disabled && (
          <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12" />
        )}
        
        {isLoading ? (
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ) : null}
        <span className="relative z-10">{children}</span>
      </motion.button>
    );
  }
);
Button.displayName = 'Button';
