'use client';

import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Line, LineChart, Area, AreaChart, Legend } from 'recharts';
import { ZoomIn, ZoomOut, Download, Maximize2 } from 'lucide-react';

interface InteractiveChartProps {
  data: any[];
  type?: 'bar' | 'line' | 'area';
  xKey: string;
  yKeys: { key: string; name: string; color: string }[];
  height?: number;
  enableZoom?: boolean;
  enableExport?: boolean;
}

export function InteractiveChart({
  data,
  type = 'bar',
  xKey,
  yKeys,
  height = 340,
  enableZoom = true,
  enableExport = true,
}: InteractiveChartProps) {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 0.2, 2));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 0.2, 0.5));
  const handleResetZoom = () => setZoomLevel(1);

  const handleExport = () => {
    const svg = document.querySelector('[data-chart="interactive"] svg');
    if (svg) {
      const svgData = new XMLSerializer().serializeToString(svg);
      const blob = new Blob([svgData], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'chart.svg';
      link.click();
      URL.revokeObjectURL(url);
    }
  };

  const toggleFullscreen = () => setIsFullscreen(!isFullscreen);

  const chartStyle = {
    transform: `scale(${zoomLevel})`,
    transformOrigin: 'top left',
    transition: 'transform 0.3s ease',
  };

  const renderChart = () => {
    const commonProps = {
      data,
      margin: { top: 20, right: 30, left: 20, bottom: 5 },
    };

    if (type === 'bar') {
      return (
        <BarChart {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey={xKey} />
          <YAxis />
          <Tooltip />
          <Legend />
          {yKeys.map(({ key, name, color }) => (
            <Bar key={key} dataKey={key} name={name} fill={color} radius={[7, 7, 0, 0]} />
          ))}
        </BarChart>
      );
    }

    if (type === 'line') {
      return (
        <LineChart {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey={xKey} />
          <YAxis />
          <Tooltip />
          <Legend />
          {yKeys.map(({ key, name, color }) => (
            <Line key={key} type="monotone" dataKey={key} name={name} stroke={color} strokeWidth={2} dot={{ r: 4 }} />
          ))}
        </LineChart>
      );
    }

    return (
      <AreaChart {...commonProps}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey={xKey} />
        <YAxis />
        <Tooltip />
        <Legend />
        {yKeys.map(({ key, name, color }) => (
          <Area key={key} type="monotone" dataKey={key} name={name} stroke={color} fill={color} fillOpacity={0.6} />
        ))}
      </AreaChart>
    );
  };

  return (
    <div className={`card ${isFullscreen ? 'fixed inset-4 z-50' : ''}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Gráfico interactivo</h3>
        <div className="flex gap-2">
          {enableZoom && (
            <>
              <button onClick={handleZoomOut} className="btn secondary" aria-label="Reducir zoom">
                <ZoomOut size={16} />
              </button>
              <button onClick={handleResetZoom} className="btn secondary" aria-label="Restablecer zoom">
                {Math.round(zoomLevel * 100)}%
              </button>
              <button onClick={handleZoomIn} className="btn secondary" aria-label="Aumentar zoom">
                <ZoomIn size={16} />
              </button>
            </>
          )}
          {enableExport && (
            <button onClick={handleExport} className="btn secondary" aria-label="Exportar gráfico">
              <Download size={16} />
            </button>
          )}
          <button onClick={toggleFullscreen} className="btn secondary" aria-label="Pantalla completa">
            <Maximize2 size={16} />
          </button>
        </div>
      </div>
      <div style={{ height, overflow: 'hidden' }}>
        <ResponsiveContainer width="100%" height="100%">
          <div style={chartStyle} data-chart="interactive">
            {renderChart()}
          </div>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
