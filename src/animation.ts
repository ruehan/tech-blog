export type Samples = number[][];

/** Exported sidecar tracks are sampled at 24fps, including both end frames. */
export function sample(values: Samples, seconds: number, fps = 24, step = false): number[] {
  if (!values.length) return [];
  const frame = Math.max(0, Math.min(seconds * fps, values.length - 1));
  const index = Math.floor(frame);
  const a = values[index];
  const b = values[Math.min(index + 1, values.length - 1)];
  return step ? [...a] : a.map((value, i) => value + (b[i] - value) * (frame - index));
}

export function blenderPosition(matrix: number[][]): [number, number, number] {
  return [matrix[0][3], matrix[2][3], -matrix[1][3]];
}

export function lensToVerticalFov(lens: number, sensorWidth: number, aspect: number) {
  return 2 * Math.atan(sensorWidth / (2 * lens * aspect)) * 180 / Math.PI;
}

export interface RuntimeClip {
  fps: number;
  interpolation?: string;
  materials: { bindings: { gltf_material_indices: number[] }[]; channels: Record<string, Samples> }[];
  lights: { node: string; source_blender_watts: Samples }[];
  camera_lens_mm_and_sensor_width_mm?: Samples;
}
export interface RoomManifest {
  interaction_roots: Record<string, string>;
  clips: { name: string; duration: number }[];
  light_setup: { name: string; color_linear: number[]; blender_energy_watts: number; matrix_world_blender: number[][]; size: number }[];
}
