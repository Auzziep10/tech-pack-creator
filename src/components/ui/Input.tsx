import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', label, error, ...props }, ref) => {
    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && <label className="text-sm font-medium text-gray-700 ml-1">{label}</label>}
        <input
          ref={ref}
          className={`w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all shadow-sm ${error ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''} ${className}`}
          {...props}
        />
        {error && <span className="text-xs text-red-500 ml-1">{error}</span>}
      </div>
    );
  }
);
Input.displayName = 'Input';
