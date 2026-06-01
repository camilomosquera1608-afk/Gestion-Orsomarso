'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, LayoutGrid, Save, RotateCcw, Settings2 } from 'lucide-react';
import { useDashboardStore, DashboardLayout, WidgetSize } from '@/stores/dashboard-store';
import { DraggableWidget } from './draggable-widget';
import { AccessibleButton } from './accessible-button';
import { cn } from '@/lib/utils';
import { widgetEnter, staggerContainer, staggerItem } from '@/lib/animations';

interface CustomizableDashboardProps {
  renderWidget: (widget: any) => React.ReactNode;
}

export function CustomizableDashboard({ renderWidget }: CustomizableDashboardProps) {
  const {
    layouts,
    activeLayoutId,
    setActiveLayout,
    createLayout,
    deleteLayout,
    updateLayout,
    addWidget,
    removeWidget,
    updateWidget,
    moveWidget,
    resizeWidget,
    toggleWidgetVisibility,
    toggleWidgetMinimize,
    resetToDefault,
  } = useDashboardStore();

  const [isEditMode, setIsEditMode] = useState(false);
  const [showLayoutMenu, setShowLayoutMenu] = useState(false);
  const [draggedWidgetId, setDraggedWidgetId] = useState<string | null>(null);

  const activeLayout = layouts.find((l) => l.id === activeLayoutId) || layouts[0];
  const visibleWidgets = activeLayout?.widgets.filter((w) => w.isVisible) || [];

  const handleCreateLayout = () => {
    const name = prompt('Nombre del nuevo layout:');
    if (name) {
      createLayout(name);
    }
  };

  const handleAddWidget = () => {
    const widgetTypes = [
      { type: 'kpi-cards', title: 'KPIs Principales' },
      { type: 'performance-chart', title: 'Gráfico de Rendimiento' },
      { type: 'wellness-chart', title: 'Wellness del Equipo' },
      { type: 'top-players-load', title: 'Top 5 por Carga' },
      { type: 'top-players-wellness', title: 'Top 5 por Wellness' },
      { type: 'load-risk', title: 'Riesgo de Carga' },
      { type: 'player-list', title: 'Lista de Jugadores' },
    ];

    const selectedType = prompt(
      'Selecciona el tipo de widget:\n' +
        widgetTypes.map((w, i) => `${i + 1}. ${w.title}`).join('\n')
    );

    if (selectedType) {
      const index = parseInt(selectedType) - 1;
      if (index >= 0 && index < widgetTypes.length) {
        addWidget(activeLayoutId, {
          type: widgetTypes[index].type,
          title: widgetTypes[index].title,
          size: 'medium',
          position: { x: 0, y: visibleWidgets.length },
          isVisible: true,
          isMinimized: false,
        });
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Dashboard Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Dashboard Personalizable
          </h2>
          <div className="relative">
            <button
              onClick={() => setShowLayoutMenu(!showLayoutMenu)}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              aria-label="Seleccionar layout"
            >
              <LayoutGrid size={16} />
              {activeLayout?.name}
            </button>
            {showLayoutMenu && (
              <div className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10">
                <div className="p-2 space-y-1">
                  {layouts.map((layout) => (
                    <button
                      key={layout.id}
                      onClick={() => {
                        setActiveLayout(layout.id);
                        setShowLayoutMenu(false);
                      }}
                      className={cn(
                        'w-full text-left px-3 py-2 text-sm rounded transition-colors',
                        layout.id === activeLayoutId
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      )}
                    >
                      {layout.name}
                      {layout.isDefault && ' (Predeterminado)'}
                    </button>
                  ))}
                </div>
                <div className="border-t border-gray-200 dark:border-gray-700 p-2">
                  <button
                    onClick={handleCreateLayout}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                  >
                    + Crear nuevo layout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <AccessibleButton
            variant={isEditMode ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setIsEditMode(!isEditMode)}
            ariaLabel={isEditMode ? 'Salir del modo edición' : 'Entrar en modo edición'}
          >
            <Settings2 size={16} className="mr-2" />
            {isEditMode ? 'Editar' : 'Personalizar'}
          </AccessibleButton>
          {isEditMode && (
            <>
              <AccessibleButton
                variant="secondary"
                size="sm"
                onClick={handleAddWidget}
                ariaLabel="Agregar widget"
              >
                <Plus size={16} className="mr-2" />
                Agregar Widget
              </AccessibleButton>
              {!activeLayout?.isDefault && (
                <AccessibleButton
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    if (confirm('¿Estás seguro de eliminar este layout?')) {
                      deleteLayout(activeLayoutId);
                    }
                  }}
                  ariaLabel="Eliminar layout"
                >
                  Eliminar Layout
                </AccessibleButton>
              )}
              <AccessibleButton
                variant="secondary"
                size="sm"
                onClick={resetToDefault}
                ariaLabel="Restablecer a predeterminado"
              >
                <RotateCcw size={16} className="mr-2" />
                Restablecer
              </AccessibleButton>
            </>
          )}
        </div>
      </div>

      {/* Dashboard Grid */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <AnimatePresence mode="popLayout">
          {visibleWidgets.map((widget) => (
            <motion.div key={widget.id} variants={staggerItem}>
              {isEditMode ? (
                <DraggableWidget
                  widget={widget}
                  isDragging={draggedWidgetId === widget.id}
                  onMove={(position) => moveWidget(activeLayoutId, widget.id, position)}
                  onResize={(size) => resizeWidget(activeLayoutId, widget.id, size)}
                  onToggleVisibility={() => toggleWidgetVisibility(activeLayoutId, widget.id)}
                  onToggleMinimize={() => toggleWidgetMinimize(activeLayoutId, widget.id)}
                  onRemove={() => removeWidget(activeLayoutId, widget.id)}
                >
                  {renderWidget(widget)}
                </DraggableWidget>
              ) : (
                <motion.div
                  variants={widgetEnter}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
                >
                  <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                    <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                      {widget.title}
                    </h3>
                  </div>
                  <div className="p-4">
                    {renderWidget(widget)}
                  </div>
                </motion.div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>

      {visibleWidgets.length === 0 && (
        <div className="text-center py-12">
          <LayoutGrid size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            No hay widgets
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Agrega widgets para personalizar tu dashboard
          </p>
          <AccessibleButton
            variant="primary"
            onClick={handleAddWidget}
            ariaLabel="Agregar primer widget"
          >
            <Plus size={16} className="mr-2" />
            Agregar Widget
          </AccessibleButton>
        </div>
      )}
    </div>
  );
}
