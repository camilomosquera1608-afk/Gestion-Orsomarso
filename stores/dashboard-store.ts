import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type WidgetSize = 'small' | 'medium' | 'large' | 'full';

export interface DashboardWidget {
  id: string;
  type: string;
  title: string;
  size: WidgetSize;
  position: { x: number; y: number };
  isVisible: boolean;
  isMinimized: boolean;
  config?: Record<string, any>;
}

export interface DashboardLayout {
  id: string;
  name: string;
  widgets: DashboardWidget[];
  columns: number;
  isDefault: boolean;
}

interface DashboardState {
  layouts: DashboardLayout[];
  activeLayoutId: string;
  setActiveLayout: (id: string) => void;
  createLayout: (name: string) => DashboardLayout;
  deleteLayout: (id: string) => void;
  updateLayout: (id: string, updates: Partial<DashboardLayout>) => void;
  addWidget: (layoutId: string, widget: Omit<DashboardWidget, 'id'>) => void;
  removeWidget: (layoutId: string, widgetId: string) => void;
  updateWidget: (layoutId: string, widgetId: string, updates: Partial<DashboardWidget>) => void;
  moveWidget: (layoutId: string, widgetId: string, position: { x: number; y: number }) => void;
  resizeWidget: (layoutId: string, widgetId: string, size: WidgetSize) => void;
  toggleWidgetVisibility: (layoutId: string, widgetId: string) => void;
  toggleWidgetMinimize: (layoutId: string, widgetId: string) => void;
  reorderWidgets: (layoutId: string, widgetIds: string[]) => void;
  resetToDefault: () => void;
}

const defaultWidgets: Omit<DashboardWidget, 'id'>[] = [
  {
    type: 'kpi-cards',
    title: 'KPIs Principales',
    size: 'full',
    position: { x: 0, y: 0 },
    isVisible: true,
    isMinimized: false,
  },
  {
    type: 'performance-chart',
    title: 'Gráfico de Rendimiento',
    size: 'large',
    position: { x: 0, y: 1 },
    isVisible: true,
    isMinimized: false,
  },
  {
    type: 'wellness-chart',
    title: 'Wellness del Equipo',
    size: 'large',
    position: { x: 1, y: 1 },
    isVisible: true,
    isMinimized: false,
  },
  {
    type: 'top-players-load',
    title: 'Top 5 por Carga',
    size: 'medium',
    position: { x: 0, y: 2 },
    isVisible: true,
    isMinimized: false,
  },
  {
    type: 'top-players-wellness',
    title: 'Top 5 por Wellness',
    size: 'medium',
    position: { x: 1, y: 2 },
    isVisible: true,
    isMinimized: false,
  },
];

const defaultLayout: DashboardLayout = {
  id: 'default',
  name: 'Layout Predeterminado',
  widgets: defaultWidgets.map((w, i) => ({ ...w, id: `widget-${i}` })),
  columns: 2,
  isDefault: true,
};

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set, get) => ({
      layouts: [defaultLayout],
      activeLayoutId: 'default',

      setActiveLayout: (id) => {
        set({ activeLayoutId: id });
      },

      createLayout: (name) => {
        const newLayout: DashboardLayout = {
          id: `layout-${Date.now()}`,
          name,
          widgets: defaultWidgets.map((w, i) => ({ ...w, id: `widget-${Date.now()}-${i}` })),
          columns: 2,
          isDefault: false,
        };
        set((state) => ({
          layouts: [...state.layouts, newLayout],
          activeLayoutId: newLayout.id,
        }));
        return newLayout;
      },

      deleteLayout: (id) => {
        set((state) => {
          const newLayouts = state.layouts.filter((l) => l.id !== id);
          const newActiveId = state.activeLayoutId === id ? 'default' : state.activeLayoutId;
          return {
            layouts: newLayouts,
            activeLayoutId: newActiveId,
          };
        });
      },

      updateLayout: (id, updates) => {
        set((state) => ({
          layouts: state.layouts.map((l) =>
            l.id === id ? { ...l, ...updates } : l
          ),
        }));
      },

      addWidget: (layoutId, widget) => {
        set((state) => ({
          layouts: state.layouts.map((l) =>
            l.id === layoutId
              ? {
                  ...l,
                  widgets: [
                    ...l.widgets,
                    { ...widget, id: `widget-${Date.now()}` },
                  ],
                }
              : l
          ),
        }));
      },

      removeWidget: (layoutId, widgetId) => {
        set((state) => ({
          layouts: state.layouts.map((l) =>
            l.id === layoutId
              ? {
                  ...l,
                  widgets: l.widgets.filter((w) => w.id !== widgetId),
                }
              : l
          ),
        }));
      },

      updateWidget: (layoutId, widgetId, updates) => {
        set((state) => ({
          layouts: state.layouts.map((l) =>
            l.id === layoutId
              ? {
                  ...l,
                  widgets: l.widgets.map((w) =>
                    w.id === widgetId ? { ...w, ...updates } : w
                  ),
                }
              : l
          ),
        }));
      },

      moveWidget: (layoutId, widgetId, position) => {
        get().updateWidget(layoutId, widgetId, { position });
      },

      resizeWidget: (layoutId, widgetId, size) => {
        get().updateWidget(layoutId, widgetId, { size });
      },

      toggleWidgetVisibility: (layoutId, widgetId) => {
        const layout = get().layouts.find((l) => l.id === layoutId);
        if (!layout) return;
        const widget = layout.widgets.find((w) => w.id === widgetId);
        if (!widget) return;
        get().updateWidget(layoutId, widgetId, { isVisible: !widget.isVisible });
      },

      toggleWidgetMinimize: (layoutId, widgetId) => {
        const layout = get().layouts.find((l) => l.id === layoutId);
        if (!layout) return;
        const widget = layout.widgets.find((w) => w.id === widgetId);
        if (!widget) return;
        get().updateWidget(layoutId, widgetId, { isMinimized: !widget.isMinimized });
      },

      reorderWidgets: (layoutId, widgetIds) => {
        set((state) => {
          const layout = state.layouts.find((l) => l.id === layoutId);
          if (!layout) return state;

          const widgetMap = new Map(layout.widgets.map((w) => [w.id, w]));
          const reorderedWidgets = widgetIds
            .map((id) => widgetMap.get(id))
            .filter((w): w is DashboardWidget => w !== undefined);

          return {
            layouts: state.layouts.map((l) =>
              l.id === layoutId ? { ...l, widgets: reorderedWidgets } : l
            ),
          };
        });
      },

      resetToDefault: () => {
        set({
          layouts: [defaultLayout],
          activeLayoutId: 'default',
        });
      },
    }),
    {
      name: 'dashboard-storage',
    }
  )
);
