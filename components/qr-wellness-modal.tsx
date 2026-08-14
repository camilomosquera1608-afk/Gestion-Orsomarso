"use client";

import React, { useState } from "react";
import { QrCode, X, Copy, Check, Smartphone, ExternalLink } from "lucide-react";
import { AccessibleButton } from "./accessible-button";

interface QrWellnessModalProps {
  category?: string;
}

export function QrWellnessModal({ category = "Sub17" }: QrWellnessModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const getPublicUrl = () => {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/wellness-jugadores`;
    }
    return "https://orsomarso-performance.vercel.app/wellness-jugadores";
  };

  const publicUrl = getPublicUrl();
  // Servicio público QR API para renderizado SVG/PNG del QR sin librerías pesadas externas
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
    publicUrl
  )}&color=10b981&bgcolor=020617`;

  const copyUrl = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <>
      <AccessibleButton
        onClick={() => setIsOpen(true)}
        className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/40 text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all font-medium"
      >
        <QrCode className="w-4 h-4" />
        Generar QR Vestuario
      </AccessibleButton>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl w-full max-w-md p-6 text-slate-100 relative space-y-5 animate-in fade-in zoom-in duration-150">
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 p-1 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center space-y-1">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mx-auto text-emerald-400">
                <Smartphone className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white">QR Cuestionario Wellness</h3>
              <p className="text-xs text-slate-400">
                Escanea desde el móvil de cualquier jugador para registrar el reporte diario
              </p>
            </div>

            {/* Renderizado QR */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col items-center justify-center">
              <img
                src={qrImageUrl}
                alt="QR Wellness Orsomarso"
                className="w-52 h-52 rounded-lg border border-slate-800 shadow-inner"
              />
              <span className="text-[11px] font-mono text-emerald-400 mt-2 font-semibold">
                Orsomarso FC • {category}
              </span>
            </div>

            {/* Copy Link & Direct Open */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-xs">
                <span className="truncate text-slate-400 font-mono flex-1">{publicUrl}</span>
                <AccessibleButton
                  onClick={copyUrl}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 p-1.5 rounded"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </AccessibleButton>
                <a
                  href={publicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white p-1.5 rounded flex items-center justify-center"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
