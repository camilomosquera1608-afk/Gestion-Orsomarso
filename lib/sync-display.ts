export const formatLastSync = (iso?: string | null) => {
  if (!iso) return 'Sin sincronización reciente';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Sin sincronización reciente';
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Hace un momento';
  if (diffMin < 60) return `Hace ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `Hace ${diffH} h`;
  return date.toLocaleString('es-CO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};

export const syncStatusLabel = (
  syncStatus: 'idle' | 'syncing' | 'ready' | 'error',
  isOnline: boolean,
) => {
  if (!isOnline) return 'Sin conexión · modo offline';
  if (syncStatus === 'syncing') return 'Sincronizando…';
  if (syncStatus === 'error') return 'Error de sincronización';
  if (syncStatus === 'ready') return 'Datos guardados';
  return 'Listo';
};
