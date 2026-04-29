import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const ignoreDirs = new Set(['node_modules', '.next', '.git', '.vercel', 'out', 'dist', 'build']);
const blockedFileNames = new Set(['.env', '.env.local', '.env.production', '.env.development.local', '.env.test.local']);
const blockedExt = new Set(['.pdf']);
const blockedPathParts = ['backups', 'exports', 'local-data'];
const blockedTextPatterns = [
  { name: 'Supabase service role', regex: /SUPABASE_SERVICE_ROLE_KEY\s*=/i },
  { name: 'JWT-like secret', regex: /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/ },
  { name: 'Legacy staff password', regex: /Orso(S15|S17|S20|Master)!2026|Divisiones2026/ },
];

const problems = [];

const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(root, full).replaceAll(path.sep, '/');
    if (entry.isDirectory()) {
      if (ignoreDirs.has(entry.name)) continue;
      if (blockedPathParts.some((part) => rel.split('/').includes(part))) {
        problems.push(`Directorio bloqueado: ${rel}`);
        continue;
      }
      walk(full);
      continue;
    }

    if (blockedFileNames.has(entry.name) || /^\.env\..*local$/.test(entry.name)) {
      problems.push(`Archivo de entorno bloqueado: ${rel}`);
      continue;
    }

    if (blockedExt.has(path.extname(entry.name).toLowerCase()) && !rel.startsWith('docs/examples/')) {
      problems.push(`PDF generado bloqueado: ${rel}`);
    }

    if (!/\.(ts|tsx|js|jsx|mjs|cjs|json|md|txt|css|sql|env|example|gitignore)$/i.test(entry.name)) continue;
    if (rel === 'scripts/preflight-check.mjs') continue;
    const raw = fs.readFileSync(full, 'utf8');
    for (const pattern of blockedTextPatterns) {
      if (pattern.regex.test(raw)) problems.push(`${pattern.name}: ${rel}`);
    }
  }
};

walk(root);

if (problems.length) {
  console.error('\nPreflight bloqueado. Revisa estos puntos antes de subir a GitHub:\n');
  for (const item of problems) console.error(`- ${item}`);
  process.exit(1);
}

console.log('Preflight OK: no se detectaron archivos sensibles básicos.');
