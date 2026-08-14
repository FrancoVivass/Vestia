import { readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const migrationsDirectory = join(root, 'supabase', 'migrations');
const output = join(root, 'supabase', 'VESTIA_BASE_DATOS_COMPLETA_2026-08-14.sql');
const migrations = (await readdir(migrationsDirectory))
  .filter(name => /^\d+.*\.sql$/i.test(name))
  .sort((left, right) => left.localeCompare(right, 'en', { numeric: true }));

const sections = [
  '-- VESTIA — BASE DE DATOS COMPLETA',
  '-- Generada desde las migraciones verificadas 001 a 021 el 14/08/2026.',
  '-- Destino: un proyecto Supabase nuevo. En el proyecto vinculado actual ya está aplicada.',
  '-- Antes de ejecutar, el usuario de plataforma configurado en 006 debe existir en Auth.',
  '',
];

for (const migration of migrations) {
  sections.push(`-- ============================================================================\n-- ${migration}\n-- ============================================================================`);
  sections.push((await readFile(join(migrationsDirectory, migration), 'utf8')).trim());
  sections.push('');
}

sections.push('-- ============================================================================\n-- CATÁLOGO DE PERMISOS (SEED)\n-- ============================================================================');
sections.push((await readFile(join(root, 'supabase', 'seed.sql'), 'utf8')).trim());
sections.push('');
await writeFile(output, `${sections.join('\n')}\n`, 'utf8');
console.log(`${migrations.length} migraciones consolidadas en ${output}`);
