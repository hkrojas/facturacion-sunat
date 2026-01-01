import React from 'react';
import { ShieldCheck, Zap, Globe, Star, ArrowUpRight } from 'lucide-react';

const AuthLayout = ({ children, title, subtitle, overline, footerLink }) => {
  return (
    <div className="fixed inset-0 w-full h-screen flex flex-col lg:grid lg:grid-cols-12 bg-white overflow-hidden">
      
      {/* COLUMNA IZQUIERDA: Identidad Visual Profunda */}
      <div className="hidden lg:flex lg:col-span-5 relative p-16 flex-col justify-between overflow-hidden bg-[#030405] border-r border-white/5">
        
        {/* Mesh Gradient Animado Sutil */}
        <div className="absolute inset-0">
          <div className="absolute top-[-10%] left-[-10%] w-[70%] h-[70%] rounded-full bg-indigo-600/20 blur-[120px]" />
          <div className="absolute bottom-[10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-blue-600/10 blur-[100px]" />
          <div className="absolute top-[40%] left-[20%] w-[30%] h-[30%] rounded-full bg-purple-600/10 blur-[80px]" />
        </div>
        
        {/* Grid de Ingeniería */}
        <div className="absolute inset-0 opacity-[0.03]" 
             style={{ backgroundImage: `linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)`, backgroundSize: '40px 40px' }}>
        </div>

        {/* Logo Section */}
        <div className="relative z-10 flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-2xl shadow-indigo-600/50 font-bold text-2xl transform -rotate-3">
            F
          </div>
          <div>
            <span className="text-white text-xl font-bold tracking-tight block leading-none">FacturaPro</span>
            <span className="text-indigo-400 text-[10px] font-bold uppercase tracking-[0.3em]">Enterprise</span>
          </div>
        </div>

        {/* Hero Content */}
        <div className="relative z-10 space-y-12">
          <div className="space-y-6">
            <h1 className="text-5xl xl:text-7xl font-extrabold text-white leading-[1.05] tracking-tighter">
              Control <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-blue-400 to-emerald-400">Total Fiscal.</span>
            </h1>
            <p className="text-slate-400 text-xl max-w-sm leading-relaxed font-medium">
              La infraestructura definitiva para la emisión de comprobantes electrónicos a escala global.
            </p>
          </div>
          
          <div className="grid grid-cols-1 gap-8">
            {[
              { icon: Zap, label: "0.4s Latency", desc: "Validación inmediata con servidores SUNAT/OSE." },
              { icon: ShieldCheck, label: "Audit-Ready", desc: "Cumplimiento normativo automatizado 24/7." },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-5 group">
                <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-indigo-600 group-hover:border-indigo-500 transition-all duration-500">
                  <item.icon size={20} className="text-indigo-400 group-hover:text-white" />
                </div>
                <div>
                  <h4 className="text-white text-sm font-bold flex items-center gap-2">
                    {item.label} <ArrowUpRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                  </h4>
                  <p className="text-slate-500 text-xs mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Status indicator */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </div>
          <span className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em]">Sistemas Operativos en Línea</span>
        </div>
      </div>

      {/* COLUMNA DERECHA: Área del Formulario */}
      <div className="flex-1 lg:col-span-7 flex flex-col items-center justify-center bg-[#f8f9fb] relative p-6 md:p-12 overflow-y-auto">
        
        <div className="w-full max-w-[460px] flex flex-col">
          
          {/* ENCABEZADO REFINADO */}
          <div className="mb-12 text-center lg:text-left">
            <span className="inline-block py-1 px-3 rounded-full bg-indigo-50 text-indigo-600 text-[10px] font-bold uppercase tracking-[0.2em] mb-4">
              {overline}
            </span>
            <h2 className="text-5xl font-black text-slate-900 tracking-tighter mb-4">
              {title}
            </h2>
            <div className="flex items-center gap-4">
              <div className="h-[2px] w-12 bg-indigo-600 rounded-full" />
              <p className="text-slate-500 text-sm font-medium">
                {subtitle}
              </p>
            </div>
          </div>

          {/* Tarjeta del Formulario */}
          <div className="bg-white p-8 md:p-12 rounded-[2.5rem] shadow-[0_30px_70px_rgba(0,0,0,0.03)] border border-slate-100 w-full transform transition-all hover:shadow-[0_30px_70px_rgba(79,70,229,0.05)]">
            {children}
          </div>

          {/* Enlace de navegación */}
          <div className="mt-10 text-center">
            {footerLink}
          </div>
        </div>

        {/* Footer Legal */}
        <div className="absolute bottom-8 left-0 right-0 text-center">
           <span className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.3em]">
             &copy; {new Date().getFullYear()} FacturaPro Global Cloud Infrastructure
           </span>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;