// Premium PDF Chart Components
import type { ReactNode } from 'react';
import { PDFTheme } from '@/lib/pdf-theme';

export interface ProgressBarProps {
  value: number;
  max: number;
  label?: string;
  color?: 'green' | 'gray' | 'amber' | 'red';
  showPercentage?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function ProgressBar({ 
  value, 
  max, 
  label, 
  color = 'gray',
  showPercentage = true,
  size = 'md'
}: ProgressBarProps) {
  const percentage = max > 0 ? Math.round((value / max) * 100) : 0;
  
  const colorStyles = {
    green: 'bg-green-600',
    gray: 'bg-gray-600',
    amber: 'bg-amber-600',
    red: 'bg-red-600',
  };
  
  const sizeStyles = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  };
  
  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs font-medium text-gray-700">{label}</span>
          {showPercentage && (
            <span className="text-xs text-gray-500">{percentage}%</span>
          )}
        </div>
      )}
      <div className={`w-full bg-gray-200 rounded-full ${sizeStyles[size]}`}>
        <div 
          className={`${colorStyles[color]} ${sizeStyles[size]} rounded-full transition-all`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export interface RankingBarProps {
  name: string;
  value: number;
  max: number;
  rank?: number;
  subtitle?: string;
  color?: 'green' | 'gray' | 'black';
  showValue?: boolean;
}

export function RankingBar({ 
  name, 
  value, 
  max, 
  rank, 
  subtitle,
  color = 'gray',
  showValue = true
}: RankingBarProps) {
  const percentage = max > 0 ? Math.round((value / max) * 100) : 0;
  
  const colorStyles = {
    green: 'bg-green-600',
    gray: 'bg-gray-600',
    black: 'bg-black',
  };
  
  const rankBadge = rank !== undefined && (
    <span className="text-xs font-bold text-white bg-black px-1.5 py-0.5 rounded">
      #{rank}
    </span>
  );
  
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-gray-900 truncate">
            {name}
          </span>
          {rankBadge}
        </div>
        {subtitle && (
          <span className="text-xs text-gray-500">{subtitle}</span>
        )}
        <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
          <div 
            className={`${colorStyles[color]} h-2 rounded-full`}
            style={{ width: `${Math.max(percentage, 5)}%` }}
          />
        </div>
      </div>
      {showValue && (
        <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">
          {value}
        </span>
      )}
    </div>
  );
}

export interface HeatIndicatorProps {
  value: number;
  min: number;
  max: number;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function HeatIndicator({ 
  value, 
  min, 
  max, 
  label,
  size = 'md'
}: HeatIndicatorProps) {
  const range = max - min;
  const normalized = range > 0 ? (value - min) / range : 0.5;
  
  // Calculate heat color (green to red)
  const hue = 120 - (normalized * 120); // 120 = green, 0 = red
  const color = `hsl(${hue}, 70%, 45%)`;
  
  const sizeStyles = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  };
  
  return (
    <div className="flex flex-col items-center">
      <div 
        className={`${sizeStyles[size]} rounded-full flex items-center justify-center`}
        style={{ backgroundColor: color }}
      >
        <span className="text-white font-bold text-sm">
          {value}
        </span>
      </div>
      {label && (
        <span className="text-xs text-gray-600 mt-1">{label}</span>
      )}
    </div>
  );
}

export interface ComparisonCardProps {
  label: string;
  teamA: { name: string; value: number | string };
  teamB: { name: string; value: number | string };
  winner?: 'A' | 'B' | 'tie';
  unit?: string;
}

export function ComparisonCard({ 
  label, 
  teamA, 
  teamB, 
  winner,
  unit = ''
}: ComparisonCardProps) {
  const winnerStyles = {
    A: 'font-bold text-green-600',
    B: 'font-bold text-green-600',
    tie: 'font-bold text-gray-900',
  };
  
  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <span className="text-xs font-medium text-gray-500 uppercase tracking-wider block mb-3">
        {label}
      </span>
      <div className="flex items-center justify-between">
        <div className="text-center flex-1">
          <span className="text-xs text-gray-500 block mb-1">{teamA.name}</span>
          <span className={`text-lg ${winner === 'A' ? winnerStyles.A : 'text-gray-900'}`}>
            {teamA.value}{unit}
          </span>
        </div>
        <div className="text-gray-400 text-sm mx-2">vs</div>
        <div className="text-center flex-1">
          <span className="text-xs text-gray-500 block mb-1">{teamB.name}</span>
          <span className={`text-lg ${winner === 'B' ? winnerStyles.B : 'text-gray-900'}`}>
            {teamB.value}{unit}
          </span>
        </div>
      </div>
    </div>
  );
}

export interface DonutChartProps {
  value: number;
  total: number;
  label?: string;
  color?: 'green' | 'gray' | 'amber' | 'red';
  size?: 'sm' | 'md' | 'lg';
}

export function DonutChart({ 
  value, 
  total, 
  label,
  color = 'green',
  size = 'md'
}: DonutChartProps) {
  const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (percentage / 100) * circumference;
  
  const colorStyles = {
    green: '#0D9467',
    gray: '#6B7280',
    amber: '#D97706',
    red: '#DC2626',
  };
  
  const sizeStyles = {
    sm: 'w-16 h-16',
    md: 'w-20 h-20',
    lg: 'w-24 h-24',
  };
  
  return (
    <div className="flex flex-col items-center">
      <div className={`${sizeStyles[size]} relative`}>
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="50%"
            cy="50%"
            r="40"
            fill="none"
            stroke="#E5E7EB"
            strokeWidth="8"
          />
          <circle
            cx="50%"
            cy="50%"
            r="40"
            fill="none"
            stroke={colorStyles[color]}
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold text-gray-900">{percentage}%</span>
        </div>
      </div>
      {label && (
        <span className="text-xs text-gray-600 mt-2">{label}</span>
      )}
    </div>
  );
}
