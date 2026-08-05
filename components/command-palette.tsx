"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, Activity, AlertTriangle, Heart, User, Shield, Calendar, FileText, X } from "lucide-react";

interface CommandItem {
  id: string;
  title: string;
  category: "Navegación" | "Acción" | "Jugador";
  href?: string;
  action?: () => void;
  icon: React.ReactNode;
}

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const items: CommandItem[] = [
    {
      id: "nav-carga",
      title: "Centro de Carga Diaria",
      category: "Navegación",
      href: "/carga",
      icon: <Activity className="w-4 h-4 text-emerald-400" />,
    },
    {
      id: "nav-riesgo",
      title: "Motor de Riesgo & Alertas",
      category: "Navegación",
      href: "/riesgo",
      icon: <AlertTriangle className="w-4 h-4 text-rose-400" />,
    },
    {
      id: "nav-wellness",
      title: "Cuestionario & Estado Wellness",
      category: "Navegación",
      href: "/wellness",
      icon: <Heart className="w-4 h-4 text-pink-400" />,
    },
    {
      id: "nav-disponibilidad",
      title: "Disponibilidad Médica & Bajas",
      category: "Navegación",
      href: "/disponibilidad",
      icon: <Shield className="w-4 h-4 text-amber-400" />,
    },
    {
      id: "nav-jugadores",
      title: "Gestión de Jugadores & Plantilla",
      category: "Navegación",
      href: "/jugadores",
      icon: <User className="w-4 h-4 text-blue-400" />,
    },
    {
      id: "nav-microciclo",
      title: "Planificación de Microciclo",
      category: "Navegación",
      href: "/microciclo",
      icon: <Calendar className="w-4 h-4 text-indigo-400" />,
    },
    {
      id: "nav-informes",
      title: "Generador de Informes PDF",
      category: "Navegación",
      href: "/informes",
      icon: <FileText className="w-4 h-4 text-violet-400" />,
    },
  ];

  const filteredItems = items.filter((item) =>
    item.title.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (item: CommandItem) => {
    setIsOpen(false);
    setQuery("");
    if (item.href) {
      router.push(item.href);
    } else if (item.action) {
      item.action();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-start justify-center pt-20 px-4 transition-all">
      <div className="bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in duration-150">
        {/* Input Bar */}
        <div className="flex items-center px-4 border-b border-slate-800 bg-slate-950/40">
          <Search className="w-5 h-5 text-slate-400 mr-3" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Escribe un comando o busca una pantalla... (Esc para salir)"
            className="w-full bg-transparent py-4 text-slate-100 placeholder-slate-500 focus:outline-none text-sm"
          />
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Command Items List */}
        <div className="max-h-80 overflow-y-auto p-2">
          {filteredItems.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">
              No se encontraron comandos para &quot;{query}&quot;
            </div>
          ) : (
            filteredItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleSelect(item)}
                className="w-full text-left px-3 py-2.5 rounded-lg flex items-center justify-between hover:bg-slate-800/80 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-md bg-slate-950 border border-slate-800 group-hover:border-slate-700">
                    {item.icon}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-200 group-hover:text-white">
                      {item.title}
                    </div>
                    <div className="text-[11px] text-slate-500">{item.category}</div>
                  </div>
                </div>
                <span className="text-xs text-slate-500 group-hover:text-emerald-400 font-mono">
                  ↵ Ir
                </span>
              </button>
            ))
          )}
        </div>

        {/* Footer shortcuts helper */}
        <div className="bg-slate-950 px-4 py-2 text-[11px] text-slate-500 border-t border-slate-800/80 flex items-center justify-between">
          <span>
            Navega con <kbd className="px-1 py-0.5 bg-slate-800 rounded text-slate-300">↑</kbd>{" "}
            <kbd className="px-1 py-0.5 bg-slate-800 rounded text-slate-300">↓</kbd>
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-300 font-mono">
              Cmd + K
            </kbd>{" "}
            para abrir / cerrar
          </span>
        </div>
      </div>
    </div>
  );
}
