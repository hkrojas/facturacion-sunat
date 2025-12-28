import React, { useState, useEffect, useRef } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';

const DatePicker = ({ label, value, onChange, error, minDate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const containerRef = useRef(null);

  // Parsear valor inicial
  const selectedDate = value ? new Date(value + 'T12:00:00') : null;

  // Cerrar al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Nombres de meses y días
  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const days = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'];

  // Generar días del mes
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysArray = [];

    // Días vacíos previos
    for (let i = 0; i < firstDay.getDay(); i++) {
      daysArray.push(null);
    }
    // Días del mes
    for (let i = 1; i <= lastDay.getDate(); i++) {
      daysArray.push(new Date(year, month, i));
    }
    return daysArray;
  };

  const handleDateClick = (date) => {
    if (!date) return;
    // Formato YYYY-MM-DD para compatibilidad con HTML date standard
    const formatted = date.toISOString().split('T')[0];
    onChange(formatted);
    setIsOpen(false);
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  return (
    <div className="relative space-y-1.5" ref={containerRef}>
      {label && <label className="block text-sm font-medium text-surface-700 dark:text-surface-300">{label}</label>}
      
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`relative w-full text-left bg-white dark:bg-surface-900 border rounded-lg py-2.5 pl-10 pr-4 shadow-sm transition-all duration-200 
          ${isOpen ? 'ring-2 ring-primary-500/20 border-primary-500' : 'hover:border-surface-400 dark:hover:border-surface-500'}
          ${error ? 'border-red-300' : 'border-surface-300 dark:border-surface-600'}
        `}
      >
        <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-surface-400">
          <CalendarIcon className={`h-5 w-5 transition-colors ${isOpen ? 'text-primary-500' : ''}`} />
        </span>
        <span className={`block truncate ${!value ? 'text-surface-400' : 'text-surface-900 dark:text-white'}`}>
          {value ? new Date(value + 'T12:00:00').toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Seleccionar fecha'}
        </span>
      </button>

      {/* Calendario Flotante Animado */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-72 bg-white dark:bg-surface-800 shadow-xl rounded-xl border border-surface-200 dark:border-surface-700 p-4 animate-fade-in origin-top-left">
          
          {/* Cabecera del Calendario */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} type="button" className="p-1 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-full transition-colors">
              <ChevronLeft className="h-5 w-5 text-surface-600 dark:text-surface-400" />
            </button>
            <span className="font-semibold text-surface-900 dark:text-white">
              {months[currentMonth.getMonth()]} {currentMonth.getFullYear()}
            </span>
            <button onClick={nextMonth} type="button" className="p-1 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-full transition-colors">
              <ChevronRight className="h-5 w-5 text-surface-600 dark:text-surface-400" />
            </button>
          </div>

          {/* Días de la semana */}
          <div className="grid grid-cols-7 mb-2">
            {days.map(d => (
              <div key={d} className="text-center text-xs font-medium text-surface-400 py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Grid de días */}
          <div className="grid grid-cols-7 gap-1">
            {getDaysInMonth(currentMonth).map((date, i) => {
              if (!date) return <div key={`empty-${i}`} />;
              
              const isSelected = selectedDate && 
                date.getDate() === selectedDate.getDate() &&
                date.getMonth() === selectedDate.getMonth() &&
                date.getFullYear() === selectedDate.getFullYear();
              
              const isToday = new Date().toDateString() === date.toDateString();

              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleDateClick(date)}
                  className={`
                    h-8 w-8 rounded-full flex items-center justify-center text-sm transition-all duration-200
                    ${isSelected 
                      ? 'bg-primary-600 text-white shadow-md shadow-primary-500/30 font-bold' 
                      : isToday 
                        ? 'text-primary-600 font-bold bg-primary-50 dark:bg-primary-900/20'
                        : 'text-surface-700 dark:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-700'
                    }
                  `}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}
      
      {error && <p className="text-sm text-red-500 animate-fade-in">{error}</p>}
    </div>
  );
};

export default DatePicker;