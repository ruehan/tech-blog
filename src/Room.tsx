import { useEffect, useLayoutEffect, useMemo, useRef, useState, useImperativeHandle, type Ref } from 'react';
import { useFrame, useLoader, useThree, type ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { AnimationAction, FileLoader, Group, LoopOnce, LoopRepeat, Matrix4, Object3D, PerspectiveCamera, RectAreaLight, Vector3 } from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { useModel } from './models';
import { asset, type WorldId } from './worlds';
import { sample, type RoomManifest, type RuntimeClip } from './animation';
import { applyRoomCamera, applyRoomRestZoom } from './room-camera';
import { blendRoomPose, captureRoomPose, ROOM_ALIGNMENT_SECONDS, type RoomPose } from './room-transition';
import { Icon } from './Icons';

RectAreaLightUniformsLib.init();
export interface RoomHandle { activate: (id: string) => void; cancel: () => void; skip: () => void }
interface Props { ref?: Ref<RoomHandle>; active: boolean; paused: boolean; lightsOn: boolean; labels: boolean; onNavigate: (world: WorldId) => void; onReady: () => void; onBusy: (busy: boolean) => void; onLights: () => void; onRead: () => void; onResetCamera: () => void }
type Playing = { name: string; time: number; duration: number; loop: boolean; action?: AnimationAction; done?: () => void; finished?: boolean };
const prefixes: Record<string, string> = { featured_book: 'Book', bass: 'Music', monitor: 'Monitor', racing: 'Simulator' };
const HOVER_BLEND_SECONDS = 0.16;
const HOVER_LEAVE_MS = 100;
// Stop as soon as the cover and loose pages have opened, before page enlargement.
// At 323/24s every authored transform matches the 5s pose; the next sample starts
// closing the book. Skip the enlargement/retraction without a visible pose jump.
const BOOK_READ_TIME = 5;
const BOOK_RETURN_TIME = 323 / 24;
const labelInfo = [
  { id: 'featured_book', root: 'INT_FeatureBook', text: '책 펼치기', icon: 'book', offset: [0, 0.45, 0] },
  { id: 'monitor', root: 'INT_Monitor', text: '컴퓨터 속으로', icon: 'desktop', offset: [0, 0.75, 0] },
  { id: 'racing', root: 'SIMRIG', text: '서킷으로', icon: 'circuit', offset: [0, 1.6, 0] },
  { id: 'bass', root: 'INT_Bass', text: '베이스 연주', icon: 'music', offset: [0, 1.3, 0] },
];

export function Room(props: Props) {
  const model = useModel('interactive/room.glb');
  const raw = useLoader(FileLoader, [asset('interactive/manifest.json'), asset('interactive/runtime-tracks.json')]);
  const manifest = useMemo(() => JSON.parse(raw[0] as string) as RoomManifest, [raw]);
  const runtime = useMemo(() => (JSON.parse(raw[1] as string) as { clips: Record<string, RuntimeClip> }).clips, [raw]);
  const { camera } = useThree();
  const playing = useRef(new Map<string, Playing>());
  const cinematic = useRef(false);
  const alignment = useRef<{ from: RoomPose; to: RoomPose; elapsed: number; done?: () => void } | null>(null);
  const restingCamera = useMemo(() => {
    const source = model.root.getObjectByName('WEB_Camera_Main');
    if (!(source instanceof PerspectiveCamera)) throw new Error('The room GLB is missing WEB_Camera_Main.');
    const snapshot = source.clone();
    source.getWorldPosition(snapshot.position);
    source.getWorldQuaternion(snapshot.quaternion);
    return snapshot;
  }, [model]);
  const bookPhase = useRef<'entering' | 'reading' | 'returning' | null>(null);
  const hovered = useRef<string | null>(null);
  const pointerTargets = useRef<{ mesh: string | null; label: string | null }>({ mesh: null, label: null });
  const hoverLeaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const fading = useRef(new Map<AnimationAction, number>());
  const [busy, setBusy] = useState(!props.paused);
  const latest = useRef(props); latest.current = props;
  const rest = useMemo(() => new Map(model.ownedMaterials.map(m => [m, { color: m.color.clone(), emissive: m.emissive.clone(), strength: m.emissiveIntensity }])), [model]);
  const materialBlends = useRef(new Map<string, { elapsed: number; from: typeof rest }>());
  const hoverMaterials = useMemo(() => new Map(Object.values(prefixes).map(prefix => {
    const indices = new Set(Object.entries(runtime)
      .filter(([name]) => name === `${prefix}_Idle` || name.startsWith(`${prefix}_Hover_`))
      .flatMap(([, clip]) => clip.materials.flatMap(track => track.bindings.flatMap(binding => binding.gltf_material_indices))));
    return [prefix, new Set([...indices].flatMap(index => model.materials.get(index) ?? []))];
  })), [model, runtime]);
  const lights = useMemo(() => {
    const group = new Group();
    const byName = new Map<string, RectAreaLight>();
    for (const entry of manifest.light_setup) {
      const light = new RectAreaLight(0xffffff, entry.blender_energy_watts / 100, entry.size, entry.size);
      light.color.fromArray(entry.color_linear);
      const matrix = new Matrix4().set(...entry.matrix_world_blender.flat() as Parameters<Matrix4['set']>);
      matrix.premultiply(new Matrix4().makeRotationX(-Math.PI / 2));
      matrix.decompose(light.position, light.quaternion, light.scale);
      light.name = entry.name; group.add(light); byName.set(entry.name, light);
    }
    return { group, byName };
  }, [manifest]);
  const hotspots = useMemo(() => {
    model.root.updateMatrixWorld(true);
    return labelInfo.map(label => {
      const node = model.root.getObjectByName(manifest.interaction_roots[label.root]);
      const position = node?.getWorldPosition(new Vector3()) ?? new Vector3();
      position.add(new Vector3(...label.offset));
      return { ...label, position };
    });
  }, [manifest, model]);

  function play(group: string, name: string, loop = false, done?: () => void) {
    const previous = playing.current.get(group);
    const blend = previous && hoverMaterials.has(group);
    if (blend) {
      materialBlends.current.set(group, { elapsed: 0, from: new Map([...hoverMaterials.get(group)!].map(material => [material, {
        color: material.color.clone(), emissive: material.emissive.clone(), strength: material.emissiveIntensity,
      }])) });
      if (previous.action) {
        // Preserve the current weight if a quick direction change interrupts a fade.
        previous.action.setEffectiveWeight(previous.action.getEffectiveWeight()).fadeOut(HOVER_BLEND_SECONDS);
        fading.current.set(previous.action, HOVER_BLEND_SECONDS);
      }
    } else previous?.action?.stop();
    const clip = model.animations.find(c => c.name === name);
    const duration = manifest.clips.find(c => c.name === name)?.duration ?? clip?.duration ?? 0;
    // Each object action owns its clip, so re-entering cannot reset an action
    // that is still fading out. Retired clips are uncached after the blend.
    const action = clip ? model.mixer.clipAction(hoverMaterials.has(group) ? clip.clone() : clip).reset().setLoop(loop ? LoopRepeat : LoopOnce, Infinity) : undefined;
    if (action) {
      action.clampWhenFinished = true;
      if (blend) action.fadeIn(HOVER_BLEND_SECONDS);
      action.play();
    }
    playing.current.set(group, { name, time: 0, duration, loop, action, done });
  }
  function idle() {
    for (const prefix of Object.values(prefixes)) play(prefix, `${prefix}_Idle`, true);
    syncSwitch();
  }
  function syncSwitch() {
    play('switch', latest.current.lightsOn ? 'Lights_On' : 'Lights_Off');
    const item = playing.current.get('switch')!;
    item.time = item.duration;
    if (item.action) { item.action.time = item.duration; item.action.paused = true; }
  }
  function clear() {
    alignment.current = null;
    bookPhase.current = null;
    clearTimeout(hoverLeaveTimer.current);
    pointerTargets.current = { mesh: null, label: null };
    for (const [group, item] of playing.current) if (hoverMaterials.has(group) && item.action) {
      model.mixer.uncacheAction(item.action.getClip(), model.root);
    }
    for (const action of fading.current.keys()) model.mixer.uncacheAction(action.getClip(), model.root);
    fading.current.clear(); materialBlends.current.clear();
    playing.current.clear(); model.mixer.stopAllAction(); hovered.current = null;
    document.body.style.cursor = '';
  }
  function finish() {
    clear(); cinematic.current = false; setBusy(false); latest.current.onBusy(false);
    latest.current.onResetCamera(); idle(); model.mixer.update(0);
  }
  function settleToRest() {
    if (!(camera instanceof PerspectiveCamera)) { finish(); return; }
    const from = captureRoomPose(model.root, camera, model.ownedMaterials, lights.byName.values());
    // Prepare the idle frame offscreen, including its materials and the closer
    // room lens. Keep controls disabled until the complete frame has converged.
    clear(); idle(); updateAnimation(0);
    applyRoomCamera(camera, restingCamera);
    applyRoomRestZoom(camera);
    const to = captureRoomPose(model.root, camera, model.ownedMaterials, lights.byName.values());
    alignment.current = { from, to, elapsed: 0, done: () => {
      cinematic.current = false; setBusy(false); latest.current.onBusy(false);
      latest.current.onResetCamera();
    } };
    blendRoomPose(from, to, 0);
  }
  function activate(id: string) {
    if (cinematic.current) return;
    if (id === 'featured_book' && latest.current.paused) { latest.current.onRead(); return; }
    if (id === 'room_lighting') { latest.current.onLights(); return; }
    const prefix = prefixes[id]; if (!prefix) return;
    if (latest.current.paused && id === 'bass') return;
    // Navigation stays usable when reduced motion or pause is selected.
    if (latest.current.paused && (id === 'monitor' || id === 'racing')) {
      latest.current.onNavigate(id === 'monitor' ? 'desktop' : 'circuit'); return;
    }
    const from = camera instanceof PerspectiveCamera ? captureRoomPose(model.root, camera, model.ownedMaterials, lights.byName.values()) : null;
    clear(); cinematic.current = true; setBusy(true); latest.current.onBusy(true);
    if (id === 'featured_book') {
      bookPhase.current = 'entering';
      play('cinematic', 'Book_Click', false, settleToRest);
    } else {
      const portal = id === 'monitor' || id === 'racing';
      play('cinematic', portal ? `${prefix}_Portal_Approach` : `${prefix}_Click`, false, () => {
        if (portal) { finish(); latest.current.onNavigate(id === 'monitor' ? 'desktop' : 'circuit'); }
        else settleToRest();
      });
    }
    // Evaluate the authored first frame without displaying it. Restore the
    // currently visible pose and move to that first frame before advancing time.
    updateAnimation(0);
    if (from && camera instanceof PerspectiveCamera) {
      const to = captureRoomPose(model.root, camera, model.ownedMaterials, lights.byName.values());
      alignment.current = { from, to, elapsed: 0 };
      blendRoomPose(from, to, 0);
    }
  }
  function holdBook() {
    const item = playing.current.get('cinematic');
    if (!item || bookPhase.current !== 'entering') return;
    if (item.action) item.action.paused = true;
    bookPhase.current = 'reading';
    latest.current.onRead();
  }
  function skip() {
    const item = playing.current.get('cinematic');
    if (bookPhase.current === 'entering' && item) {
      alignment.current = null;
      item.time = BOOK_READ_TIME;
      if (item.action) item.action.time = BOOK_READ_TIME;
      updateAnimation(0);
    } else finish();
  }
  useImperativeHandle(props.ref, () => ({ activate, cancel: finish, skip }));
  useEffect(() => {
    if (!props.active || bookPhase.current !== 'reading') return;
    if (props.paused) { finish(); return; }
    const item = playing.current.get('cinematic')!;
    item.time = BOOK_RETURN_TIME;
    if (item.action) { item.action.time = BOOK_RETURN_TIME; item.action.paused = false; }
    bookPhase.current = 'returning';
  }, [props.active]);
  useEffect(() => { if (!cinematic.current) syncSwitch(); }, [props.lightsOn]);
  useLayoutEffect(() => {
    if (latest.current.paused) idle();
    else {
      setBusy(true); latest.current.onBusy(true); cinematic.current = true;
      play('opening', 'Room_Opening', false, settleToRest);
    }
    // Evaluate frame zero before revealing the room, including its camera,
    // lights and materials, so the static model cannot flash ahead of the intro.
    updateAnimation(0);
    latest.current.onReady();
    return () => { clear(); latest.current.onBusy(false); };
  }, [model, manifest]);

  function applyRuntime(clip: RuntimeClip | undefined, time: number) {
    if (!clip) return;
    const value = (values: number[][]) => sample(values, time, clip.fps, clip.interpolation === 'STEP');
    for (const track of clip.materials) {
      const channels = Object.fromEntries(Object.entries(track.channels).map(([key, values]) => [key, value(values)]));
      const indices = new Set(track.bindings.flatMap(b => b.gltf_material_indices));
      for (const index of indices) for (const material of model.materials.get(index) ?? []) {
        if (channels.baseColor) material.color.fromArray(channels.baseColor);
        if (channels.emissiveColor) material.emissive.fromArray(channels.emissiveColor);
        if (channels.emissiveStrength) material.emissiveIntensity = channels.emissiveStrength[0];
      }
    }
    for (const track of clip.lights) {
      const light = lights.byName.get(track.node);
      if (light) light.intensity = value(track.source_blender_watts)[0] / 100;
    }
  }
  function updateAnimation(dt: number) {
    if (alignment.current) {
      const transition = alignment.current;
      transition.elapsed = Math.min(transition.elapsed + dt, ROOM_ALIGNMENT_SECONDS);
      blendRoomPose(transition.from, transition.to, transition.elapsed / ROOM_ALIGNMENT_SECONDS);
      if (transition.elapsed >= ROOM_ALIGNMENT_SECONDS) {
        alignment.current = null;
        transition.done?.();
      }
      return;
    }
    if (bookPhase.current === 'entering') {
      dt = Math.min(dt, Math.max(0, BOOK_READ_TIME - playing.current.get('cinematic')!.time));
    } else if (bookPhase.current === 'reading') dt = 0;
    model.mixer.update(dt);
    for (const [action, remaining] of fading.current) {
      if (remaining <= dt) {
        action.stop(); model.mixer.uncacheAction(action.getClip(), model.root); fading.current.delete(action);
      } else fading.current.set(action, remaining - dt);
    }
    for (const [material, state] of rest) {
      material.color.copy(state.color); material.emissive.copy(state.emissive); material.emissiveIntensity = state.strength;
    }
    for (const entry of manifest.light_setup) lights.byName.get(entry.name)!.intensity = entry.blender_energy_watts / 100;
    const completed: (() => void)[] = [];
    for (const item of playing.current.values()) {
      item.time = item.loop && item.duration > 0 ? (item.time + dt) % item.duration : Math.min(item.time + dt, item.duration);
      applyRuntime(runtime[item.name], item.time);
      if (!item.loop && !item.finished && item.time >= item.duration) {
        item.finished = true; if (item.done) completed.push(item.done);
      }
    }
    // Sidecar material tracks need the same handoff as the GLB transforms.
    for (const [group, blend] of materialBlends.current) {
      blend.elapsed += dt;
      const weight = Math.min(blend.elapsed / HOVER_BLEND_SECONDS, 1);
      for (const [material, from] of blend.from) {
        material.color.lerp(from.color, 1 - weight);
        material.emissive.lerp(from.emissive, 1 - weight);
        material.emissiveIntensity = from.strength + (material.emissiveIntensity - from.strength) * weight;
      }
      if (weight === 1) materialBlends.current.delete(group);
    }
    // Lighting is an independent persistent layer, applied after object effects.
    if (!playing.current.has('opening')) applyRuntime(runtime[props.lightsOn ? 'Lights_On' : 'Lights_Off'], 1);
    const active = playing.current.get('cinematic') ?? playing.current.get('opening');
    const sourceCamera = model.root.getObjectByName('WEB_Camera_Main');
    if (active && sourceCamera instanceof PerspectiveCamera && camera instanceof PerspectiveCamera) {
      model.root.updateMatrixWorld(true);
      const lensTrack = runtime[active.name]?.camera_lens_mm_and_sensor_width_mm;
      applyRoomCamera(camera, sourceCamera, lensTrack ? sample(lensTrack, active.time) : undefined);
    }
    if (bookPhase.current === 'entering' && active && active.time >= BOOK_READ_TIME) completed.push(holdBook);
    completed.forEach(done => done());
  }
  useFrame((_, delta) => updateAnimation(props.paused ? 0 : Math.min(delta, 0.05)));
  function interaction(object: Object3D | null): string | null {
    while (object) {
      if (object.userData.interaction_id) return object.userData.interaction_id;
      object = object.parent;
    }
    return null;
  }
  function hover(id: string | null) {
    if (cinematic.current || hovered.current === id) return;
    const oldPrefix = prefixes[hovered.current ?? ''];
    if (oldPrefix) play(oldPrefix, `${oldPrefix}_Hover_Exit`, false, () => {
      if (prefixes[hovered.current ?? ''] !== oldPrefix) play(oldPrefix, `${oldPrefix}_Idle`, true);
    });
    hovered.current = id;
    const prefix = prefixes[id ?? ''];
    if (prefix) play(prefix, `${prefix}_Hover_Enter`, false, () => {
      if (hovered.current === id) play(prefix, `${prefix}_Hover_Hold`);
    });
    document.body.style.cursor = id ? 'pointer' : '';
  }
  function pointerHover(id: string | null, source: 'mesh' | 'label') {
    if (cinematic.current) return;
    pointerTargets.current[source] = id;
    // The HTML label owns the pointer while it covers the canvas. Discard any
    // stale mesh hit rather than returning to it when the label is left.
    if (source === 'label' && id) pointerTargets.current.mesh = null;
    const target = pointerTargets.current.label ?? pointerTargets.current.mesh;
    clearTimeout(hoverLeaveTimer.current);
    if (target) hover(target);
    else {
      // R3F emits out/over for individual child meshes. Coalesce those events
      // (and brief animated edge misses) before treating them as a real exit.
      hoverLeaveTimer.current = setTimeout(() => hover(null), HOVER_LEAVE_MS);
    }
  }
  const click = (event: ThreeEvent<MouseEvent>) => {
    if (event.delta > 5) return;
    const id = interaction(event.object); if (id) { event.stopPropagation(); activate(id); }
  };
  return <group>
    <primitive object={lights.group} />
    <primitive object={model.root} dispose={null} onClick={click} onPointerMove={(event: ThreeEvent<PointerEvent>) => { event.stopPropagation(); pointerHover(interaction(event.object), 'mesh'); }} onPointerOut={() => pointerHover(null, 'mesh')} />
    {props.labels && !busy && hotspots.map(label => <Html key={label.id} position={label.position} center zIndexRange={[20, 0]}>
      <button className="hotspot" aria-label={label.text} disabled={props.paused && label.id === 'bass'} onPointerEnter={() => pointerHover(label.id, 'label')} onPointerLeave={() => pointerHover(null, 'label')} onClick={() => activate(label.id)}><Icon name={label.icon} size={18}/></button>
    </Html>)}
  </group>;
}
