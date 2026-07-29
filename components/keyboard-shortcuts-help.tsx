'use client';

import { useEffect, useState } from 'react';
import { X, Keyboard } from 'lucide-react';
import { keyboardShortcuts, commonShortcuts } from '@/lib/keyboard-shortcuts';

interface ShortcutHelpProps {
  onClose?: () => void;
}

export function KeyboardShortcutsHelp({ onClose }: ShortcutHelpProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleHelpShortcut = () => setIsOpen(true);
    keyboardShortcuts.register({
      key: '?',
      description: 'Mostrar ayuda de atajos',
      action: handleHelpShortcut,
    });

    return () => {
      keyboardShortcuts.unregister({
        key: '?',
        description: 'Mostrar ayuda de atajos',
        action: handleHelpShortcut,
      });
    };
  }, []);

  const shortcuts = [
    { key: 'Ctrl + K', description: 'Búsqueda', action: commonShortcuts.search },
    { key: 'Ctrl + S', description: 'Guardar', action: commonShortcuts.save },
    { key: 'Ctrl + N', description: 'Nuevo', action: commonShortcuts.new },
    { key: 'Ctrl + E', description: 'Exportar', action: commonShortcuts.export },
    { key: '?', description: 'Ayuda', action: () => setIsOpen(true) },
    { key: 'Ctrl + H', description: 'Inicio', action: commonShortcuts.home },
    { key: 'Ctrl + P', description: 'Jugadores', action: commonShortcuts.players },
    { key: 'Ctrl + W', description: 'Wellness', action: commonShortcuts.wellness },
    { key: 'Ctrl + C', description: 'Competencia', action: commonShortcuts.competition },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Keyboard size={20} />
            <h2 className="text-lg font-semibold">Atajos de teclado</h2>
          </div>
          <button
            onClick={() => {
              setIsOpen(false);
              onClose?.();
            }}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <div className="grid gap-3">
            {shortcuts.map((shortcut) => (
              <div
                key={shortcut.key}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
              >
                <span className="text-sm text-gray-700 dark:text-gray-300">{shortcut.description}</span>
                <kbd className="px-2 py-1 text-xs font-mono bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded">
                  {shortcut.key}
                </kbd>
              </div>
            ))}
          </div>
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Tip:</strong> Presiona <kbd className="px-1 py-0.5 text-xs font-mono bg-white dark:bg-gray-600 border border-blue-300 dark:border-blue-500 rounded">?</kbd> en cualquier momento para ver esta ayuda.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
