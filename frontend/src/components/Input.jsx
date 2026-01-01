import React, { forwardRef } from 'react';

const Input = forwardRef(({ label, error, icon: Icon, className = '', ...props }, ref) => {
  return (
    <div className={`w-full group ${className}`}>
      {label && (
        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-[0.15em] mb-2.5 ml-1">
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-600 transition-colors duration-300">
            <Icon size={18} strokeWidth={2.5} />
          </div>
        )}
        <input
          ref={ref}
          className={`
            w-full bg-[#fcfdfe] border-2 border-slate-100 text-slate-900 text-sm rounded-2xl 
            placeholder:text-slate-400 outline-none transition-all duration-300
            py-3.5 ${Icon ? 'pl-12' : 'pl-5'} pr-5
            focus:border-indigo-600 focus:bg-white focus:ring-[6px] focus:ring-indigo-600/5
            ${error ? 'border-red-500 bg-red-50/20' : 'hover:border-slate-200'}
          `}
          {...props}
        />
      </div>
      {error && (
        <p className="mt-2.5 ml-1 text-xs font-bold text-red-500 flex items-center gap-1 animate-in fade-in slide-in-from-top-1">
          {error}
        </p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;