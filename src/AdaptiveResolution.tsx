import { useLayoutEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { FrameBudget } from './frame-budget';

export function AdaptiveResolution({ enabled, onChange, resolution }: { enabled: boolean; onChange: (dpr: number) => void; resolution: number }) {
  const width = useThree(state => state.size.width);
  const height = useThree(state => state.size.height);
  const frameloop = useThree(state => state.frameloop);
  const gl = useThree(state => state.gl);
  const budget = useMemo(() => new FrameBudget(window.devicePixelRatio, width, height), [width, height]);
  useLayoutEffect(() => { if (enabled) onChange(budget.dpr); }, [budget, enabled, onChange]);
  useLayoutEffect(() => { budget.resetSampling(); }, [budget, enabled, frameloop]);
  useLayoutEffect(() => {
    gl.transmissionResolutionScale = enabled && resolution < 1 ? 0.5 : 1;
  }, [enabled, gl, resolution]);
  useFrame(() => {
    if (!enabled || frameloop !== 'always') return;
    const dpr = budget.frame(performance.now());
    if (dpr !== undefined) onChange(dpr);
  });
  return null;
}
