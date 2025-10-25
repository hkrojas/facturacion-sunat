// src/components/Card.jsx
import React from 'react';

const Card = ({ children, className = '' }) => {
  return (
    <div className={`bg-white dark:bg-gray-800 p-6 sm:p-8 rounded-lg shadow-xl ${className}`}>
      {children}
    </div>
  );
};

export default Card;