// Premium PDF Visualizations - Radar, Heat Maps, etc.
import type { ReactNode } from 'react';

export interface RadarChartProps {
  data: { label: string; value: number }[];
  size?: 'sm' | 'md' | 'lg';
  color?: string;
}

export function RadarChart({ data, size = 'md', color = '#0D9467' }: RadarChartProps) {
  const sizeStyles = {
    sm: 200,
    md: 300,
    lg: 400,
  };
  
  const radius = sizeStyles[size] / 2;
  const center = radius;
  const maxValue = Math.max(...data.map(d => d.value), 1);
  
  const points = data.map((item, index) => {
    const angle = (index * 2 * Math.PI) / data.length - Math.PI / 2;
    const value = (item.value / maxValue) * (radius - 20);
    const x = center + value * Math.cos(angle);
    const y = center + value * Math.sin(angle);
    return `${x},${y}`;
  }).join(' ');

  const backgroundPoints = data.map((_, index) => {
    const angle = (index * 2 * Math.PI) / data.length - Math.PI / 2;
    const x = center + (radius - 20) * Math.cos(angle);
    const y = center + (radius - 20) * Math.sin(angle);
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="flex flex-col items-center">
      <svg width={sizeStyles[size]} height={sizeStyles[size]} viewBox={`0 0 ${sizeStyles[size]} ${sizeStyles[size]}`}>
        {/* Background grid */}
        <polygon
          points={backgroundPoints}
          fill="none"
          stroke="#E5E7EB"
          strokeWidth="1"
        />
        
        {/* Data polygon */}
        <polygon
          points={points}
          fill={color}
          fillOpacity="0.2"
          stroke={color}
          strokeWidth="2"
        />
        
        {/* Labels */}
        {data.map((item, index) => {
          const angle = (index * 2 * Math.PI) / data.length - Math.PI / 2;
          const x = center + (radius - 5) * Math.cos(angle);
          const y = center + (radius - 5) * Math.sin(angle);
          return (
            <text
              key={item.label}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="text-xs fill-gray-600"
            >
              {item.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

export interface HeatMapProps {
  data: { x: number; y: number; value: number }[];
  width?: number;
  height?: number;
  cellSize?: number;
}

export function HeatMap({ data, width = 300, height = 200, cellSize = 20 }: HeatMapProps) {
  const maxValue = Math.max(...data.map(d => d.value), 1);
  
  const getColor = (value: number) => {
    const intensity = value / maxValue;
    const hue = 120 - intensity * 120; // Green to red
    return `hsl(${hue}, 70%, 45%)`;
  };

  return (
    <div className="flex flex-col items-center">
      <svg width={width} height={height}>
        {data.map((cell, index) => (
          <rect
            key={index}
            x={cell.x * cellSize}
            y={cell.y * cellSize}
            width={cellSize - 2}
            height={cellSize - 2}
            fill={getColor(cell.value)}
            rx={2}
          />
        ))}
      </svg>
    </div>
  );
}

export interface SlopeChartProps {
  data: { label: string; start: number; end: number }[];
  width?: number;
  height?: number;
}

export function SlopeChart({ data, width = 400, height = 200 }: SlopeChartProps) {
  const maxValue = Math.max(...data.flatMap(d => [d.start, d.end]), 1);
  const minValue = Math.min(...data.flatMap(d => [d.start, d.end]), 0);
  const range = maxValue - minValue || 1;
  
  const getY = (value: number) => height - ((value - minValue) / range) * (height - 40) - 20;
  const getX = (index: number) => 20 + (index * (width - 40)) / (data.length - 1 || 1);

  return (
    <div className="flex flex-col items-center">
      <svg width={width} height={height}>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map(t => (
          <line
            key={t}
            x1={20}
            y1={20 + t * (height - 40)}
            x2={width - 20}
            y2={20 + t * (height - 40)}
            stroke="#E5E7EB"
            strokeWidth={1}
          />
        ))}
        
        {/* Slope lines */}
        {data.map((item, index) => {
          const x1 = getX(0);
          const y1 = getY(item.start);
          const x2 = getX(1);
          const y2 = getY(item.end);
          const isImproving = item.end > item.start;
          
          return (
            <g key={item.label}>
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={isImproving ? '#0D9467' : '#DC2626'}
                strokeWidth={2}
              />
              <circle cx={x1} cy={y1} r={4} fill="#6B7280" />
              <circle cx={x2} cy={y2} r={4} fill={isImproving ? '#0D9467' : '#DC2626'} />
              <text
                x={x1}
                y={y1 - 10}
                textAnchor="middle"
                className="text-xs fill-gray-600"
              >
                {item.start}
              </text>
              <text
                x={x2}
                y={y2 - 10}
                textAnchor="middle"
                className="text-xs fill-gray-600"
              >
                {item.end}
              </text>
              <text
                x={x1}
                y={height - 5}
                textAnchor="middle"
                className="text-xs fill-gray-600"
              >
                {item.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export interface TimelineProps {
  events: { time: string; label: string; type?: 'goal' | 'card' | 'sub' | 'other' }[];
  width?: number;
  height?: number;
}

export function Timeline({ events, width = 400, height = 60 }: TimelineProps) {
  const typeColors = {
    goal: '#0D9467',
    card: '#DC2626',
    sub: '#6B7280',
    other: '#D97706',
  };

  return (
    <div className="flex flex-col items-center">
      <svg width={width} height={height}>
        {/* Timeline line */}
        <line
          x1={20}
          y1={height / 2}
          x2={width - 20}
          y2={height / 2}
          stroke="#E5E7EB"
          strokeWidth={2}
        />
        
        {/* Events */}
        {events.map((event, index) => {
          const x = 20 + (index * (width - 40)) / (events.length - 1 || 1);
          const color = event.type ? typeColors[event.type] : typeColors.other;
          
          return (
            <g key={index}>
              <circle cx={x} cy={height / 2} r={6} fill={color} />
              <text
                x={x}
                y={height / 2 - 12}
                textAnchor="middle"
                className="text-xs fill-gray-600"
              >
                {event.time}
              </text>
              <text
                x={x}
                y={height / 2 + 20}
                textAnchor="middle"
                className="text-xs fill-gray-600"
              >
                {event.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export interface MomentumChartProps {
  data: { time: number; value: number }[];
  width?: number;
  height?: number;
}

export function MomentumChart({ data, width = 400, height = 150 }: MomentumChartProps) {
  const maxValue = Math.max(...data.map(d => d.value), 1);
  const minValue = Math.min(...data.map(d => d.value), -1);
  const range = maxValue - minValue || 1;
  
  const getX = (index: number) => 20 + (index * (width - 40)) / (data.length - 1 || 1);
  const getY = (value: number) => height / 2 - ((value - minValue) / range) * (height - 40) / 2;

  const points = data.map((item, index) => `${getX(index)},${getY(item.value)}`).join(' ');

  return (
    <div className="flex flex-col items-center">
      <svg width={width} height={height}>
        {/* Zero line */}
        <line
          x1={20}
          y1={height / 2}
          x2={width - 20}
          y2={height / 2}
          stroke="#E5E7EB"
          strokeWidth={1}
          strokeDasharray="4 4"
        />
        
        {/* Momentum line */}
        <polyline
          points={points}
          fill="none"
          stroke="#0D9467"
          strokeWidth={2}
        />
        
        {/* Points */}
        {data.map((item, index) => (
          <circle
            key={index}
            cx={getX(index)}
            cy={getY(item.value)}
            r={3}
            fill="#0D9467"
          />
        ))}
      </svg>
    </div>
  );
}
