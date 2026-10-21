import test from 'node:test';
import assert from 'node:assert/strict';
import { FrameBudget } from '../src/frame-budget.ts';

function clock(budget: FrameBudget) {
  let time = 0;
  budget.frame(time);
  return (fps: number, seconds: number) => {
    const changes: number[] = [];
    for (let i = 0; i < fps * seconds; i++) {
      const value = budget.frame(time += 1000 / fps);
      if (value !== undefined) changes.push(value);
    }
    return changes;
  };
}

test('initial 3D resolution accounts for viewport pixels and device density', () => {
  assert.equal(new FrameBudget(2, 2400, 1270).dpr, 0.65);
  assert.equal(new FrameBudget(2, 1280, 730).dpr, 1.25);
  assert.equal(new FrameBudget(1, 1280, 730).dpr, 1);
  assert.equal(new FrameBudget(3, 320, 640).dpr, 1.5);
  assert.equal(new FrameBudget(0.5, 320, 640).dpr, 0.5);
});

test('sustained slow frames lower resolution gradually and respect the quality floor', () => {
  const budget = new FrameBudget(2, 320, 640);
  const run = clock(budget);
  assert.deepEqual(run(60, 4), []);
  assert.deepEqual(run(30, 3), [1.25]);
  run(30, 40);
  assert.equal(budget.dpr, 0.6);
});

test('isolated stalls, inactive demand intervals and resume do not degrade resolution', () => {
  const budget = new FrameBudget(2, 320, 640);
  const run = clock(budget);
  assert.deepEqual(run(60, 2), []);
  assert.deepEqual(run(30, 0.2), []);
  assert.deepEqual(run(60, 3), []);
  budget.resetSampling();
  for (let time = 10000; time < 30000; time += 2000) budget.frame(time);
  assert.equal(budget.dpr, 1.5);
});

test('recovery waits for sustained 60fps and stops retrying an unsuccessful higher resolution', () => {
  const budget = new FrameBudget(2, 320, 640);
  const run = clock(budget);
  run(30, 3);
  assert.equal(budget.dpr, 1.25);
  assert.deepEqual(run(60, 7), []);
  assert.deepEqual(run(60, 6), [1.5]);
  for (let i = 0; i < 300 && budget.dpr === 1.5; i++) run(30, 1 / 30);
  assert.equal(budget.dpr, 1.25);
  assert.deepEqual(run(60, 30), []);
  assert.equal(budget.dpr, 1.25);
});
