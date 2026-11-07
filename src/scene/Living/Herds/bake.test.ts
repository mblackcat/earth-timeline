import { Box3, Matrix4, Mesh, Quaternion, Vector3 } from "three";
import { VISUALS } from "../../../data/visuals";
import { buildRig } from "../../Models/builders";
import { bakeSpecies, partTag } from "./bakeSpecies";
import { surfaceQuaternion } from "./surfaceFrame";

describe("surfaceQuaternion", () => {
  it("maps local up to the surface normal and local +Z to the heading (0 = north, π/2 = east)", () => {
    const q = surfaceQuaternion([0, 0], 0, new Quaternion());
    expect(new Vector3(0, 1, 0).applyQuaternion(q).toArray().map((v) => +v.toFixed(6) + 0)).toEqual([0, 0, 1]);
    expect(new Vector3(0, 0, 1).applyQuaternion(q).toArray().map((v) => +v.toFixed(6) + 0)).toEqual([0, 1, 0]);
    const east = surfaceQuaternion([0, 0], Math.PI / 2, new Quaternion());
    expect(new Vector3(0, 0, 1).applyQuaternion(east).toArray().map((v) => +v.toFixed(6) + 0)).toEqual([1, 0, 0]);
  });
  it("is a proper rotation everywhere", () => {
    for (const ll of [[30, 45], [-120, -60], [179, 89]] as const) {
      const q = surfaceQuaternion([ll[0], ll[1]], 1.3, new Quaternion());
      expect(new Matrix4().makeRotationFromQuaternion(q).determinant()).toBeCloseTo(1);
    }
  });
});

describe("bakeSpecies", () => {
  it("tags parts by joint name", () => {
    expect(partTag("neck1")).toBe(1);
    expect(partTag("jaw")).toBe(1);
    expect(partTag("tail2")).toBe(2);
    expect(partTag("tailFin")).toBe(2);
    expect(partTag("legFLLower")).toBe(3);
    expect(partTag("wingL")).toBe(3);
    expect(partTag("body")).toBe(0);
  });

  it.each(VISUALS.map((v) => [v.id, v] as const))("%s bakes into one geometry matching the LOD1 rig", (_id, v) => {
    const rig = buildRig(v, 1, "tone");
    let verts = 0;
    rig.root.traverse((o) => {
      if (o instanceof Mesh && o.name !== "outline") verts += o.geometry.index ? o.geometry.index.count : o.geometry.getAttribute("position").count;
    });
    const b = bakeSpecies(v, "tone");
    expect(b.fill.getAttribute("position").count).toBe(verts);
    for (const name of ["normal", "aOutDir", "aPart", "aH"]) expect(b.fill.getAttribute(name), name).toBeDefined();
    expect(b.extent).toBeCloseTo(rig.extent, 5);
    expect(b.outline).toBe(true);
    const size = new Box3().setFromBufferAttribute(b.fill.getAttribute("position") as never).getSize(new Vector3());
    // Rig.extent comes from Box3.setFromObject (imprecise: AABB of rotated part AABBs), so it is an upper bound.
    const tight = Math.max(size.x, size.y, size.z, b.height);
    expect(tight).toBeLessThanOrEqual(b.extent + 1e-5);
    expect(tight).toBeGreaterThan(b.extent * 0.95);
    expect(bakeSpecies(v, "plain").outline).toBe(false);
    rig.dispose();
    b.dispose();
  });
});
