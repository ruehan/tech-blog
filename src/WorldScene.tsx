import { Suspense, useEffect, useLayoutEffect, useRef } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import { AgXToneMapping, LoopOnce, PCFShadowMap, PerspectiveCamera, Vector3 } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { Room, type RoomHandle } from './Room';
import { useModel } from './models';
import { asset, cockpitCamera, worlds, type ViewId, type WorldId } from './worlds';
import { applyRoomCamera, applyRoomRestZoom } from './room-camera';

interface Props {
  world: WorldId; view: ViewId; paused: boolean; active: boolean; onRead: () => void; lightsOn: boolean; labels: boolean;
  reset: number; busy: boolean; roomRef: React.RefObject<RoomHandle | null>;
  onNavigate: (world: WorldId) => void; onReady: () => void; onBusy: (busy: boolean) => void;
  onLights: () => void; onResetCamera: () => void; folderOpen: boolean; onFolderToggle: () => void; onFolderOpened: () => void;
}
function CameraRig({ world, view, reset, busy }: { world: Exclude<WorldId, 'room'>; view: ViewId; reset: number; busy: boolean }) {
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera, size } = useThree();
  const config = worlds[world];
  const cockpit = world === 'circuit' && view === 'cockpit';
  useLayoutEffect(() => {
    if (!(camera instanceof PerspectiveCamera)) return;
    camera.zoom = 1;
    if (cockpit) {
      camera.position.set(...cockpitCamera.position);
      camera.quaternion.identity(); // The authored driver looks straight down -Z.
      camera.fov = cockpitCamera.fov;
      camera.near = 0.03;
      camera.far = 1600;
      camera.updateProjectionMatrix();
      return;
    }
    const closeup = world === 'circuit' && view === 'car';
    const target = new Vector3(...(closeup ? [-3, 0.7, 0] : config.target));
    const position = new Vector3(...(closeup ? [-9, 4.2, 8] : config.position));
    const portrait = size.width < 700;
    if (portrait) position.sub(target).multiplyScalar(world === 'desktop' ? 2.5 : 1.45).add(target);
    camera.position.copy(position); camera.fov = closeup ? 42 : config.fov;
    // A close near plane at circuit overview distances causes road/terrain z-fighting.
    camera.near = world === 'circuit' && !closeup ? 5 : 0.1;
    camera.far = world === 'circuit' ? 1600 : 150;
    camera.lookAt(target); camera.updateProjectionMatrix();
    controls.current?.target.copy(target); controls.current?.update();
  }, [world, view, reset, size.width, size.height, camera, config, cockpit]);
  // Orbiting around a target would pull the camera out of the driver's seat.
  if (cockpit) return null;
  return <OrbitControls ref={controls} makeDefault enabled={!busy} enableDamping dampingFactor={0.08} enablePan={false} minDistance={world === 'circuit' ? (view === 'car' ? 3 : 70) : config.min} maxDistance={config.max} minPolarAngle={0.15} maxPolarAngle={world === 'desktop' ? Math.PI / 2 : Math.PI / 2.05} />;
}

function RoomCameraRig({ reset, busy }: Pick<Props, 'reset' | 'busy'>) {
  const gltf = useGLTF(asset(worlds.room.file));
  const source = gltf.scene.getObjectByName('WEB_Camera_Main');
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera, size } = useThree();
  if (!(source instanceof PerspectiveCamera)) throw new Error('The room GLB is missing WEB_Camera_Main.');
  useLayoutEffect(() => {
    if (!(camera instanceof PerspectiveCamera)) return;
    applyRoomCamera(camera, source);
    // Only the resting view uses the requested extra zoom; animation data stays original.
    applyRoomRestZoom(camera);
    // A guessed lookAt target changes the exported rotation. Keep OrbitControls
    // centered on the exact optical axis of the authored camera instead.
    const anchor = gltf.scene.getObjectByName('WEB_Target_Room');
    const distance = anchor ? camera.position.distanceTo(anchor.getWorldPosition(new Vector3())) : camera.position.length();
    controls.current?.target.copy(new Vector3(0, 0, -1).applyQuaternion(camera.quaternion).multiplyScalar(distance).add(camera.position));
    controls.current?.update();
  }, [camera, source, gltf, reset, size.width, size.height]);
  return <OrbitControls ref={controls} makeDefault enabled={!busy} enableDamping dampingFactor={0.08} enablePan={false} minDistance={6} maxDistance={36} minPolarAngle={0.15} maxPolarAngle={Math.PI / 2.05}/>;
}

function Desktop({ paused, open, onToggle, onReady, onOpened }: { paused: boolean; open: boolean; onToggle: () => void; onReady: () => void; onOpened: () => void }) {
  const model = useModel('worlds/computer-desktop.glb');
  const folderTime = useRef(0);
  const opened = useRef(false);
  const folder = model.animations.find(a => a.name === 'DesktopFolderOpen')!;
  useEffect(() => {
    const ambient = model.animations.find(a => a.name === 'DesktopAmbient');
    if (ambient) model.mixer.clipAction(ambient).play();
    const action = model.mixer.clipAction(folder).setLoop(LoopOnce, 1).play();
    action.paused = true; action.clampWhenFinished = true;
    onReady();
    return () => { model.mixer.stopAllAction(); document.body.style.cursor = ''; };
  }, [model]);
  useFrame((_, delta) => {
    const desired = open ? folder.duration : 0;
    const direction = Math.sign(desired - folderTime.current);
    folderTime.current = paused ? desired : Math.max(0, Math.min(folder.duration, folderTime.current + direction * Math.min(delta, 0.05)));
    model.mixer.clipAction(folder).time = folderTime.current;
    model.mixer.update(paused ? 0 : Math.min(delta, 0.05));
    if (!open) opened.current = false;
    if (open && folderTime.current >= folder.duration && !opened.current) {
      opened.current = true;
      onOpened();
    }
  });
  function isFolder(event: ThreeEvent<PointerEvent | MouseEvent>) {
    let object = event.object;
    while (object) {
      if (/Projects/i.test(object.name)) return true;
      if (!object.parent) break; object = object.parent;
    }
    return false;
  }
  return <primitive object={model.root} dispose={null} onClick={(event: ThreeEvent<MouseEvent>) => { if (event.delta <= 5 && isFolder(event)) { event.stopPropagation(); onToggle(); } }} onPointerMove={(event: ThreeEvent<PointerEvent>) => { event.stopPropagation(); document.body.style.cursor = isFolder(event) ? 'pointer' : ''; }} onPointerOut={() => { document.body.style.cursor = ''; }} />;
}

function Circuit({ onReady }: { onReady: () => void }) {
  const circuit = useModel('worlds/apex-circuit.glb');
  const car = useModel('worlds/formula-car-animated.glb');
  useEffect(() => { onReady(); }, [circuit, car]);
  return <group><primitive object={circuit.root} dispose={null}/><group position={[-3, 0, 0]}><primitive object={car.root} dispose={null}/></group></group>;
}

export default function WorldScene(props: Props) {
  const room = props.world === 'room';
  return <Canvas frameloop={props.active ? 'always' : 'never'} shadows={{ type: PCFShadowMap }} dpr={[1, 1.5]} gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }} onCreated={({ gl }) => { gl.toneMapping = AgXToneMapping; gl.toneMappingExposure = 1.15; }} fallback={<span className="sr-only">3D 공간. 하단 메뉴로 월드를 선택할 수 있습니다.</span>}>
    <hemisphereLight args={['#e9f2ff', '#b7a48a', room && !props.lightsOn ? 0.65 : 1.7]} />
    <directionalLight position={room ? [3, 8, 5] : [30, 80, 30]} intensity={room ? (props.lightsOn ? 1.6 : 0.35) : 3} color="#fff2dc" castShadow={props.world !== 'circuit'} shadow-mapSize={[2048, 2048]} shadow-camera-left={-14} shadow-camera-right={14} shadow-camera-top={14} shadow-camera-bottom={-14} shadow-camera-far={160} shadow-bias={-0.0003} shadow-normalBias={0.035} />
    {props.world !== 'room' && <CameraRig world={props.world} view={props.view} reset={props.reset} busy={props.busy}/>}
    <Suspense fallback={null}>
      {room && <RoomCameraRig reset={props.reset} busy={props.busy}/>}
      <group key={props.world}>
        {room && <Room ref={props.roomRef} active={props.active} paused={props.paused} lightsOn={props.lightsOn} labels={props.labels} onNavigate={props.onNavigate} onReady={props.onReady} onBusy={props.onBusy} onLights={props.onLights} onRead={props.onRead} onResetCamera={props.onResetCamera}/>}
        {props.world === 'desktop' && <Desktop paused={props.paused} open={props.folderOpen} onToggle={props.onFolderToggle} onOpened={props.onFolderOpened} onReady={props.onReady}/>}
        {props.world === 'circuit' && <Circuit onReady={props.onReady}/>}
      </group>
    </Suspense>
  </Canvas>;
}
