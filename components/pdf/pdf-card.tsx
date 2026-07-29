// Premium PDF Card Components
import type { ReactNode } from 'react';
import { PDFTheme } from '@/lib/pdf-theme';

export interface PDFCardProps {
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'elevated' | 'bordered';
  padding?: keyof PDFTheme['spacing'];
}

export function PDFCard({ 
  children, 
  className = '', 
  variant = 'default',
  padding = 'lg'
}: PDFCardProps) {
  const baseStyles = 'bg-white rounded-lg';
  
  const variants = {
    default: '',
    elevated: 'shadow-md',
    bordered: 'border border-gray-200',
  };
  
  const paddingStyles: Record<keyof PDFTheme['spacing'], string> = {
    xs: 'p-2',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-5',
    xl: 'p-6',
    '2xl': 'p-8',
    '3xl': 'p-10',
    '4xl': 'p-12',
    '5xl': 'p-14',
    '6xl': 'p-16',
  };
  
  return (
    <div className={`${baseStyles} ${variants[variant]} ${paddingStyles[padding]} ${className}`}>
      {children}
    </div>
  );
}

export interface PDFKPIProps {
  label: string;
  value: string | number;
  unit?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  description?: string;
  color?: 'green' | 'gray' | 'black';
  size?: 'sm' | 'md' | 'lg';
}

export function PDFKPI({ 
  label, 
  value, 
  unit, 
  trend, 
  trendValue, 
  description,
  color = 'gray',
  size = 'md'
}: PDFKPIProps) {
  const colorStyles = {
    green: 'text-green-600',
    gray: 'text-gray-900',
    black: 'text-black',
  };
  
  const sizeStyles = {
    sm: 'text-2xl',
    md: 'text-3xl',
    lg: 'text-4xl',
  };
  
  const trendColors = {
    up: 'text-green-600',
    down: 'text-red-600',
    neutral: 'text-gray-500',
  };
  
  return (
    <div className="flex flex-col">
      <span className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
        {label}
      </span>
      <div className="flex items-baseline gap-1">
        <span className={`font-bold ${sizeStyles[size]} ${colorStyles[color]}`}>
          {value}
        </span>
        {unit && (
          <span className="text-sm text-gray-500 font-medium">
            {unit}
          </span>
        )}
      </div>
      {(trend || trendValue) && (
        <div className="flex items-center gap-2 mt-1">
          {trend && (
            <span className={`text-xs font-medium ${trendColors[trend]}`}>
              {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
            </span>
          )}
          {trendValue && (
            <span className="text-xs text-gray-600">
              {trendValue}
            </span>
          )}
        </div>
      )}
      {description && (
        <p className="text-xs text-gray-500 mt-2">
          {description}
        </p>
      )}
    </div>
  );
}

export interface PDFStatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  tone?: 'green' | 'amber' | 'red' | 'gray';
}

export function PDFStatCard({ 
  title, 
  value, 
  subtitle, 
  icon,
  tone = 'gray'
}: PDFStatCardProps) {
  const toneStyles = {
    green: 'bg-green-50 border-green-200',
    amber: 'bg-amber-50 border-amber-200',
    red: 'bg-red-50 border-red-200',
    gray: 'bg-gray-50 border-gray-200',
  };
  
  const iconToneStyles = {
    green: 'text-green-600',
    amber: 'text-amber-600',
    red: 'text-red-600',
    gray: 'text-gray-600',
  };
  
  return (
    <div className={`border rounded-lg p-4 ${toneStyles[tone]}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            {title}
          </span>
          <div className="mt-1">
            <span className="text-2xl font-bold text-gray-900">
              {value}
            </span>
          </div>
          {subtitle && (
            <p className="text-xs text-gray-600 mt-1">
              {subtitle}
            </p>
          )}
        </div>
        {icon && (
          <div className={`${iconToneStyles[tone]}`}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
