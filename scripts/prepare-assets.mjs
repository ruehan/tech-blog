import { mkdir, copyFile, readFile, writeFile, access, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { optimizeModel } from './optimize-model.mjs';

// Keep the supplied Blender export untouched; publish only runtime assets.
const files = [
  'interactive/room.glb', 'interactive/manifest.json', 'interactive/runtime-tracks.json',
  'interactive/room-glb-verified.png', 'worlds/computer-desktop.glb',
  'worlds/apex-circuit.glb', 'worlds/formula-car-animated.glb',
];
const cachePath = 'public/assets/.prepared.json';
let cache = {};
try { cache = JSON.parse(await readFile(cachePath, 'utf8')); } catch { /* First preparation. */ }
const pipeline = await Promise.all(['scripts/prepare-assets.mjs', 'scripts/optimize-model.mjs', 'package-lock.json'].map(file => readFile(file)));
const nextCache = {};
for (const file of files) {
  const target = `public/assets/${file}`;
  await mkdir(dirname(target), { recursive: true });
  if (!file.endsWith('.glb')) {
    await copyFile(`blog-room-v27/${file}`, target);
    continue;
  }
  const source = await readFile(`blog-room-v27/${file}`);
  const hash = createHash('sha256').update(source);
  for (const part of pipeline) hash.update(part);
  const key = hash.digest('hex');
  nextCache[file] = key;
  let exists = false;
  try { await access(target); exists = true; } catch { /* Missing output. */ }
  if (cache[file] === key && exists) continue;
  const output = await optimizeModel(source);
  await writeFile(`${target}.tmp`, output);
  await rename(`${target}.tmp`, target);
  console.log(`${file}: ${(source.length / 1e6).toFixed(2)} → ${(output.length / 1e6).toFixed(2)} MB`);
}
await writeFile(cachePath, JSON.stringify(nextCache));
console.log(`Prepared ${files.length} runtime assets.`);
