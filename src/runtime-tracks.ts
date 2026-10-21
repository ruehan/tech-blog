import type { MeshStandardMaterial, RectAreaLight } from 'three';
import { sampleInto, type RuntimeClip } from './animation.ts';

/** Resolve bindings once at load time. Per-frame work only interpolates and assigns values. */
export function compileRuntimeClips(clips: Record<string, RuntimeClip>, materials: Map<number, MeshStandardMaterial[]>, lights: Map<string, RectAreaLight>) {
  return new Map(Object.entries(clips).map(([name, clip]) => {
    const materialTracks = clip.materials.map(track => ({
      targets: [...new Set(track.bindings.flatMap(binding => binding.gltf_material_indices))].flatMap(index => materials.get(index) ?? []),
      channels: Object.entries(track.channels).map(([channel, samples]) => ({ channel, samples, output: [] as number[] })),
    }));
    const lightTracks = clip.lights.map(track => ({ target: lights.get(track.node), samples: track.source_blender_watts, output: [] as number[] }));
    return [name, (time: number) => {
      for (const track of materialTracks) for (const channel of track.channels) {
        const value = sampleInto(channel.samples, time, channel.output, clip.fps, clip.interpolation === 'STEP');
        for (const material of track.targets) {
          if (channel.channel === 'baseColor') material.color.fromArray(value);
          else if (channel.channel === 'emissiveColor') material.emissive.fromArray(value);
          else if (channel.channel === 'emissiveStrength') material.emissiveIntensity = value[0];
        }
      }
      for (const track of lightTracks) if (track.target) {
        track.target.intensity = sampleInto(track.samples, time, track.output, clip.fps, clip.interpolation === 'STEP')[0] / 100;
      }
    }] as const;
  }));
}
