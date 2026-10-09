import { describe, expect, it } from 'vitest';
// The optimization script runs offline, never inside the application.
// @ts-expect-error Offline JavaScript tool has no TypeScript declarations.
import { RETAIN_RATIO, protectedVertices } from '../../scripts/optimize-sofa.mjs';
import report from '../assets/sofa-optimization-report.json';

describe('conservative sofa optimization', () => {
  it('removes 20%, rather than retaining only 20%, of the original triangles', () => {
    expect(RETAIN_RATIO).toBe(0.8);
    expect(report.originalTriangles).toBe(173612);
    expect(report.optimizedTriangles).toBe(138888);
    expect(Math.abs(report.optimizedTriangles - report.originalTriangles * 0.8)).toBeLessThanOrEqual(2);
  });

  it('locks every corner of triangles crossing a module join', () => {
    const positions = new Float32Array([-1,-0.4,-1, 1,0.4,1, -0.02,0.1,0.1, 0.02,0.12,0.11, 0.03,0.14,0.13, 0.2,0.1,0.1]);
    const locks = protectedVertices(positions, new Uint32Array([2,3,4]));
    expect(Array.from(locks.slice(2,5))).toEqual([1,1,1]);
    expect(locks[5]).toBe(0);
  });

  it('protects leg and base vertices even away from join planes', () => {
    const positions = new Float32Array([-1,-0.4,-1, 1,0.4,1, 0.2,-0.31,0.1, 0.2,0.1,0.1]);
    expect(Array.from(protectedVertices(positions, new Uint32Array()))).toEqual([1,1,1,0]);
  });
});