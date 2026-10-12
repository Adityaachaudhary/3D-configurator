import * as THREE from "three";
import { describe, expect, it } from "vitest";

import {
  alignToFloor,
  isFloorSurfaceTransform,
  projectSurface,
  splitSofaGeometry,
} from "@/lib/ar-surface";
import { splitARIndices } from "@/lib/ar-geometry";

describe("AR sofa geometry", () => {
  it("keeps the full sofa bounds on the supplied floor while repositioning", () => {
    const sofa = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 1));
    mesh.position.y = 1;
    sofa.add(mesh);
    sofa.rotation.y = Math.PI / 4;

    alignToFloor(sofa, new THREE.Vector3(2, 0.35, -3));
    const bounds = new THREE.Box3().setFromObject(sofa);
    const center = bounds.getCenter(new THREE.Vector3());

    expect(bounds.min.y).toBeCloseTo(0.35, 5);
    expect(center.x).toBeCloseTo(2, 5);
    expect(center.z).toBeCloseTo(-3, 5);
    mesh.geometry.dispose();
  });

  it("only offers upward-facing horizontal surfaces for floor placement", () => {
    expect(isFloorSurfaceTransform(new THREE.Matrix4().elements)).toBe(true);
    expect(isFloorSurfaceTransform(new THREE.Matrix4().makeRotationX(Math.PI / 2).elements)).toBe(
      false,
    );
    expect(isFloorSurfaceTransform(new THREE.Matrix4().makeRotationX(Math.PI).elements)).toBe(
      false,
    );
    expect(
      isFloorSurfaceTransform(new THREE.Matrix4().makeTranslation(0, 0.8, 0).elements, 0, 0.35),
    ).toBe(false);
  });

  it("adds analytic diamond padding and seam relief for Chesterfield materials", () => {
    const material = new THREE.MeshPhysicalMaterial();
    projectSurface(material, 5, true);
    const shader = {
      vertexShader:
        "#include <common>\nvoid main() {\n#include <project_vertex>\n#include <worldpos_vertex>\n}",
      fragmentShader:
        "#include <common>\n#include <map_fragment>\n#include <color_fragment>\n#include <roughnessmap_fragment>\n#include <bumpmap_pars_fragment>\n#include <normal_fragment_maps>",
      uniforms: {},
    } as Parameters<THREE.MeshPhysicalMaterial["onBeforeCompile"]>[0];

    material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);

    expect(shader.vertexShader).toContain("arTuftOffset");
    expect(shader.fragmentShader).toContain("arTuftShade");
    expect(shader.fragmentShader).toContain("arTuftGradientView");
    expect(shader.uniforms["arTuftDensity"]?.value).toBe(4.5);
    expect(material.customProgramCacheKey()).toContain("tufted");
    material.dispose();
  });

  it("splits the upholstery from all four spatially detected leg cones", () => {
    const positions: number[] = [];
    const indices: number[] = [];
    const addTriangle = (x: number, y: number, z: number) => {
      const start = positions.length / 3;
      positions.push(x - 0.005, y, z, x + 0.005, y, z, x, y, z + 0.005);
      indices.push(start, start + 1, start + 2);
    };

    addTriangle(0, 0.2, 0);
    for (const x of [-0.8, 0.8]) {
      for (const z of [-0.3, 0.3]) {
        addTriangle(x, -0.39, z);
        addTriangle(x, -0.31, z);
      }
    }

    const source = new THREE.BufferGeometry();
    source.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    source.setIndex(indices);

    const split = splitSofaGeometry(source);
    const splitAsyncIndices = splitARIndices(
      source.getAttribute("position").array as Float32Array,
      Uint32Array.from(source.index!.array),
    );
    expect(split.groups).toEqual([
      { start: 0, count: 3, materialIndex: 0 },
      { start: 3, count: 24, materialIndex: 1 },
    ]);
    expect(splitAsyncIndices.upholsteryIndexCount).toBe(3);
    expect(Array.from(splitAsyncIndices.indices)).toEqual(Array.from(split.index!.array));
    expect(split.userData["arMaterialGroups"]).toBe(true);

    source.dispose();
    split.dispose();
  });
});
