'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
  variant?: 'default' | 'circle' | 'text' | 'card' | 'table';
  width?: string | number;
  height?: string | number;
  lines?: number;
}

export function Skeleton({
  className,
  variant = 'default',
  width,
  height,
  lines = 3,
}: SkeletonProps) {
  const baseClasses = 'bg-gray-200 dark:bg-gray-700 rounded';
  
  const variantClasses = {
    default: 'rounded-md',
    circle: 'rounded-full',
    text: 'rounded h-4',
    card: 'rounded-lg',
    table: 'rounded-sm',
  };

  const style = {
    width: width || (variant === 'circle' ? '40px' : '100%'),
    height: height || (variant === 'circle' ? '40px' : variant === 'text' ? '16px' : '100%'),
  };

  if (variant === 'text' && lines > 1) {
    return (
      <div className={cn('space-y-2', className)}>
        {Array.from({ length: lines }).map((_, i) => (
          <motion.div
            key={i}
            className={cn(baseClasses, variantClasses.text)}
            style={{
              width: i === lines - 1 ? '70%' : '100%',
              height: '16px',
            }}
            animate={{
              backgroundPosition: ['200% 0', '-200% 0'],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: 'linear',
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <motion.div
      className={cn(baseClasses, variantClasses[variant], className)}
      style={style}
      animate={{
        backgroundPosition: ['200% 0', '-200% 0'],
      }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: 'linear',
      }}
    />
  );
}

// Pre-built skeleton components for common UI patterns

export function CardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex items-start justify-between mb-4">
        <div className="space-y-2">
          <Skeleton variant="text" width="150px" />
          <Skeleton variant="text" width="100px" />
        </div>
        <Skeleton variant="circle" width="40px" height="40px" />
      </div>
      <div className="space-y-3">
        <Skeleton variant="text" />
        <Skeleton variant="text" />
        <Skeleton variant="text" width="60%" />
      </div>
    </div>
  );
}

export function KPICardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <Skeleton variant="text" width="120px" />
        <Skeleton variant="circle" width="32px" height="32px" />
      </div>
      <Skeleton variant="text" width="80px" height="32px" className="mb-2" />
      <Skeleton variant="text" width="100px" />
    </div>
  );
}

export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="border-b border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <Skeleton variant="text" width="150px" />
          <Skeleton variant="text" width="100px" />
        </div>
      </div>
      <div className="p-4 space-y-3">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="flex items-center space-x-4">
            {Array.from({ length: columns }).map((_, colIndex) => (
              <Skeleton
                key={colIndex}
                variant="text"
                width={colIndex === 0 ? '40px' : colIndex === columns - 1 ? '80px' : '100%'}
                className="flex-1"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-6">
        <Skeleton variant="text" width="180px" />
        <div className="flex space-x-2">
          <Skeleton variant="text" width="60px" />
          <Skeleton variant="text" width="60px" />
        </div>
      </div>
      <div className="h-64 flex items-end justify-between space-x-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton
            key={i}
            variant="default"
            width="100%"
            height={`${Math.random() * 60 + 20}%`}
            className="flex-1"
          />
        ))}
      </div>
    </div>
  );
}

export function PlayerCardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex items-center space-x-4">
        <Skeleton variant="circle" width="48px" height="48px" />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" width="120px" />
          <Skeleton variant="text" width="80px" />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="text-center">
            <Skeleton variant="text" width="40px" className="mx-auto mb-1" />
            <Skeleton variant="text" width="30px" className="mx-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <KPICardSkeleton key={i} />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <PlayerCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export function ListSkeleton({ items = 5 }: { items?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-4">
            <Skeleton variant="circle" width="40px" height="40px" />
            <div className="flex-1 space-y-2">
              <Skeleton variant="text" width="150px" />
              <Skeleton variant="text" width="100px" />
            </div>
            <Skeleton variant="text" width="60px" />
          </div>
        </div>
      ))}
    </div>
  );
}
