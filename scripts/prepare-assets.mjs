import { mkdir, copyFile } from 'node:fs/promises';
import { dirname } from 'node:path';

// Keep the supplied Blender export untouched; publish only runtime assets.
const files = [
  'interactive/room.glb', 'interactive/manifest.json', 'interactive/runtime-tracks.json',
  'interactive/room-glb-verified.png', 'worlds/computer-desktop.glb',
  'worlds/apex-circuit.glb', 'worlds/formula-car-animated.glb',
];
for (const file of files) {
  const target = `public/assets/${file}`;
  await mkdir(dirname(target), { recursive: true });
  await copyFile(`blog-room-v27/${file}`, target);
}
console.log(`Prepared ${files.length} runtime assets.`);
