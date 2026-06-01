'use client';

import React, { useState, useRef } from 'react';
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { GripVertical, Minimize2, Maximize2, X, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DashboardWidget, WidgetSize } from '@/stores/dashboard-store';
import { widgetEnter } from '@/lib/animations';

interface DraggableWidgetProps {
  widget: DashboardWidget;
  children: React.ReactNode;
  onMove: (position: { x: number; y: number }) => void;
  onResize: (size: WidgetSize) => void;
  onToggleVisibility: () => void;
  onToggleMinimize: () => void;
  onRemove: () => void;
  onConfigure?: () => void;
  isDragging?: boolean;
}

const sizeClasses: Record<WidgetSize, string> = {
  small: 'col-span-1',
  medium: 'col-span-1 md:col-span-2',
  large: 'col-span-1 md:col-span-2 lg:col-span-3',
  full: 'col-span-1 md:col-span-2 lg:col-span-4',
};

export function DraggableWidget({
  widget,
  children,
  onMove,
  onResize,
  onToggleVisibility,
  onToggleMinimize,
  onRemove,
  onConfigure,
  isDragging = false,
}: DraggableWidgetProps) {
  const [isHovered, setIsHovered] = useState(false);
  const constraintsRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const handleDragEnd = (_: any, info: PanInfo) => {
    onMove({ x: info.offset.x, y: info.offset.y });
    x.set(0);
    y.set(0);
  };

  const sizeOptions: { label: string; value: WidgetSize }[] = [
    { label: 'Pequeño', value: 'small' },
    { label: 'Mediano', value: 'medium' },
    { label: 'Grande', value: 'large' },
    { label: 'Completo', value: 'full' },
  ];

  return (
    <motion.div
      ref={constraintsRef}
      variants={widgetEnter}
      initial="hidden"
      animate="visible"
      className={cn(
        'bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden',
        sizeClasses[widget.size],
        widget.isMinimized ? 'h-16' : 'min-h-[300px]',
        isDragging && 'shadow-lg scale-105 z-50'
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      drag
      dragConstraints={constraintsRef}
      dragElastic={0.1}
      onDragEnd={handleDragEnd}
      style={{ x, y }}
      role="region"
      aria-label={widget.title}
    >
      {/* Widget Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
        <div className="flex items-center gap-2">
          <div
            className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            aria-label="Arrastrar widget"
          >
            <GripVertical size={16} />
          </div>
          <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">
            {widget.title}
          </h3>
        </div>
        <div className="flex items-center gap-1">
          {onConfigure && (
            <button
              onClick={onConfigure}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              aria-label="Configurar widget"
            >
              <Settings size={14} />
            </button>
          )}
          <button
            onClick={onToggleMinimize}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            aria-label={widget.isMinimized ? 'Expandir widget' : 'Minimizar widget'}
          >
            {widget.isMinimized ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
          </button>
          <button
            onClick={onRemove}
            className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            aria-label="Eliminar widget"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Widget Content */}
      {!widget.isMinimized && (
        <div className="p-4 h-full">
          {children}
        </div>
      )}

      {/* Size Selector (shown on hover) */}
      {isHovered && !widget.isMinimized && (
        <div className="absolute top-16 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-2 z-10">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 px-1">
            Tamaño
          </div>
          <div className="space-y-1">
            {sizeOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => onResize(option.value)}
                className={cn(
                  'block w-full text-left px-2 py-1 text-sm rounded transition-colors',
                  widget.size === option.value
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
