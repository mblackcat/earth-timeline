import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { BufferAttribute, BufferGeometry, Color, Vector3 } from "three";
import { useFossilSitesStore, useSceneStore } from "../../state/sceneStore";
import { useSelectionStore } from "../../state/selectionStore";
import { useViewStore } from "../../state/viewStore";
import { lonLatToXYZ } from "../../utils/geo";
import { SPECIES_COLORS } from "./speciesColors";

const SITE_RADIUS = 1.004;
/** 点击判定半径（像素），换算为世界单位后随高度变化。 */
const PICK_PX = 7;

interface Built {
  geometry: BufferGeometry;
  /** 第 i 个点属于哪个物种。 */
  owners: string[];
}

function buildPoints(entries: { id: string; sites: [number, number][] }[]): Built {
  const owners: string[] = [];
  const pos: number[] = [];
  const col: number[] = [];
  const c = new Color();
  for (const { id, sites } of entries) {
    c.set(SPECIES_COLORS[id] ?? "#ffffff");
    for (const [lon, lat] of sites) {
      pos.push(...lonLatToXYZ(lon, lat, SITE_RADIUS));
      col.push(c.r, c.g, c.b);
      owners.push(id);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
  geometry.setAttribute("color", new BufferAttribute(new Float32Array(col), 3));
  return { geometry, owners };
}

/**
 * 可见物种的化石点（PBDB，现代坐标）。
 * 仅在可见物种集合变化时重建几何体；选中物种的点放大显示。
 */
export function FossilSites() {
  const species = useSceneStore((s) => s.visible.species);
  const data = useFossilSitesStore((s) => s.data);
  const selectedId = useSelectionStore((s) => s.selectedSpeciesId);
  const selectSpecies = useSelectionStore((s) => s.selectSpecies);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);

  const entries = useMemo(
    () => (data ? species.map((s) => ({ id: s.id, sites: data.species[s.id]?.sites ?? [] })).filter((e) => e.sites.length) : []),
    [species, data],
  );
  const all = useMemo(() => buildPoints(entries), [entries]);
  const selected = useMemo(() => buildPoints(entries.filter((e) => e.id === selectedId)), [entries, selectedId]);
  useEffect(() => () => all.geometry.dispose(), [all]);
  useEffect(() => () => selected.geometry.dispose(), [selected]);

  // 点的拾取阈值随相机高度变化：保持约 PICK_PX 像素。
  useFrame((state) => {
    const altitude = useViewStore.getState().altitude || 1;
    const worldPerPx = (2 * altitude * Math.tan((45 * Math.PI) / 360)) / Math.max(1, size.height);
    state.raycaster.params.Points = { threshold: worldPerPx * PICK_PX };
  });

  if (!entries.length) return null;

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 4 || e.index == null) return; // 拖动地球时不算点击
    // 排除球体背面的点（射线会穿过不参与拾取的地球网格）
    const p = new Vector3().fromBufferAttribute(all.geometry.getAttribute("position") as BufferAttribute, e.index);
    if (p.clone().normalize().dot(camera.position.clone().sub(p).normalize()) <= 0) return;
    e.stopPropagation();
    const id = all.owners[e.index];
    if (id) selectSpecies(id);
  };

  return (
    <group name="fossil-sites">
      <points geometry={all.geometry} onClick={onClick}>
        <pointsMaterial vertexColors size={5} sizeAttenuation={false} depthWrite={false} transparent opacity={0.9} />
      </points>
      {selected.owners.length > 0 && (
        <points geometry={selected.geometry} raycast={() => null}>
          <pointsMaterial vertexColors size={10} sizeAttenuation={false} depthWrite={false} />
        </points>
      )}
    </group>
  );
}
