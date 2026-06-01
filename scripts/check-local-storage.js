// Script para verificar y recuperar datos de localStorage
// Ejecutar en la consola del navegador

const STORAGE_KEY = "orsomarso-performance-hub";
const STORAGE_BACKUPS_KEY = "orsomarso-performance-hub-backups-v1";
const STORAGE_COMPETITION_SAFETY_KEY = "orsomarso-competition-safety-cache-v1";
const STORAGE_EVALUATIONS_SAFETY_KEY = "orsomarso-evaluations-safety-cache-v1";

console.log("=== VERIFICANDO LOCALSTORAGE ===");

// Verificar datos principales
const mainData = localStorage.getItem(STORAGE_KEY);
if (mainData) {
  try {
    const parsed = JSON.parse(mainData);
    console.log("✅ DATOS PRINCIPALES encontrados:");
    console.log("- Jugadores:", parsed.players?.length || 0);
    console.log("- Microciclos:", parsed.microcycles?.length || 0);
    console.log("- Sesiones:", parsed.trainingSessionSummaries?.length || 0);
    console.log("- Wellness:", parsed.wellness?.length || 0);
    console.log("- Carga interna:", parsed.internalLoads?.length || 0);
    console.log("- Carga externa:", parsed.externalLoads?.length || 0);
    console.log("- Competencia:", parsed.competitionRecords?.length || 0);
    console.log("- Partidos:", parsed.competitionMatchSummaries?.length || 0);
    console.log("- Valoraciones (CMJ):", parsed.cmjRecords?.length || 0);
    console.log("- Valoraciones (Nutrición):", parsed.nutritionRecords?.length || 0);
    console.log("- Valoraciones (Neuromuscular):", parsed.neuromuscularRecords?.length || 0);
    console.log("- Valoraciones (FMS):", parsed.fmsRecords?.length || 0);
  } catch (e) {
    console.log("❌ Error al parsear datos principales:", e);
  }
} else {
  console.log("❌ No hay datos principales en localStorage");
}

// Verificar backups
const backupsData = localStorage.getItem(STORAGE_BACKUPS_KEY);
if (backupsData) {
  try {
    const backups = JSON.parse(backupsData);
    console.log("\n✅ BACKUPS encontrados:", backups.length);
    backups.forEach((backup, index) => {
      console.log(`\nBackup ${index + 1}:`);
      console.log("- ID:", backup.id);
      console.log("- Fecha:", backup.createdAt);
      console.log("- Tipo:", backup.kind);
      console.log("- Label:", backup.label);
      console.log("- Jugadores:", backup.playersCount);
      console.log("- Registros:", backup.recordsCount);
      console.log("- Microciclos:", backup.microcyclesCount);
      console.log("- Sesiones:", backup.sessionsCount);
      console.log("- Partidos:", backup.matchesCount);
    });
  } catch (e) {
    console.log("❌ Error al parsear backups:", e);
  }
} else {
  console.log("\n❌ No hay backups en localStorage");
}

// Verificar safety cache de competencia
const competitionSafety = localStorage.getItem(STORAGE_COMPETITION_SAFETY_KEY);
if (competitionSafety) {
  try {
    const parsed = JSON.parse(competitionSafety);
    console.log("\n✅ SAFETY CACHE COMPETENCIA encontrado:");
    console.log("- Partidos:", parsed.competitionMatchSummaries?.length || 0);
    console.log("- Registros:", parsed.competitionRecords?.length || 0);
    console.log("- Actualizado:", parsed.updatedAt);
  } catch (e) {
    console.log("❌ Error al parsear safety cache competencia:", e);
  }
} else {
  console.log("\n❌ No hay safety cache de competencia");
}

// Verificar safety cache de evaluaciones
const evaluationsSafety = localStorage.getItem(STORAGE_EVALUATIONS_SAFETY_KEY);
if (evaluationsSafety) {
  try {
    const parsed = JSON.parse(evaluationsSafety);
    console.log("\n✅ SAFETY CACHE EVALUACIONES encontrado:");
    console.log("- Nutrición:", parsed.nutritionRecords?.length || 0);
    console.log("- CMJ:", parsed.cmjRecords?.length || 0);
    console.log("- Neuromuscular:", parsed.neuromuscularRecords?.length || 0);
    console.log("- FMS:", parsed.fmsRecords?.length || 0);
    console.log("- Actualizado:", parsed.updatedAt);
  } catch (e) {
    console.log("❌ Error al parsear safety cache evaluaciones:", e);
  }
} else {
  console.log("\n❌ No hay safety cache de evaluaciones");
}

console.log("\n=== INSTRUCCIONES PARA RECUPERAR ===");
console.log("1. Si hay datos principales, la app debería cargarlos automáticamente");
console.log("2. Si hay backups, puedes restaurar desde la UI en Configuración > Backups");
console.log("3. Si hay safety caches, se fusionarán automáticamente con los datos principales");
