import React, { useState } from 'react';
import { Eye } from 'lucide-react';

interface OpticalImageProps {
  src: string;
  alt: string;
  className?: string;
}

export const formatNaira = (amount: number): string => {
  return `₦${Math.round(amount || 0).toLocaleString('en-NG')}`;
};

export const OpticalImage: React.FC<OpticalImageProps> = ({ src, alt, className = '' }) => {
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#0B192C] via-[#132A4A] to-[#1E3A5F] text-white/90 p-6 text-center ${className}`}
      >
        <Eye className="w-8 h-8 text-[#C5A059] mb-2 opacity-90" />
        <span className="text-xs font-medium tracking-wide text-slate-200 max-w-[180px] truncate">{alt}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
      className={className}
    />
  );
};
