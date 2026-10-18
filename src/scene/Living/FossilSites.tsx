import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { BufferAttribute, BufferGeometry, Color, Vector3 } from "three";
import { useGeographyStore } from "../../state/geographyStore";
import { useFossilSitesStore, usePaleoPointsStore, useSceneStore } from "../../state/sceneStore";
import { frameFor, speciesSitesInFrame } from "../../simulation/paleoPositions";
import { useSelectionStore } from "../../state/selectionStore";
import { useViewStore } from "../../state/viewStore";
import { lonLatToXYZ } from "../../utils/geo";
import { INK } from "../Ink/inkPalette";
import { SPECIES_COLORS_MUTED } from "./speciesColors";

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
    c.set(SPECIES_COLORS_MUTED[id] ?? INK.ink3);
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
 * 可见物种的化石点（PBDB）。板块重建时期显示旋转后的古位置，全新世显示现代位置。
 * 仅在可见物种集合变化时重建几何体；选中物种的点放大显示。
 */
export function FossilSites() {
  const species = useSceneStore((s) => s.visible.species);
  const data = useFossilSitesStore((s) => s.data);
  const paleo = usePaleoPointsStore((s) => s.data);
  const reconstructionMa = useGeographyStore((s) => s.slice?.reconstructionMa);
  const selectedId = useSelectionStore((s) => s.selectedSpeciesId);
  const selectSpecies = useSelectionStore((s) => s.selectSpecies);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);

  // 化石点与海岸线始终使用同一参考系：重建切片下用古坐标，否则用现代坐标。
  const entries = useMemo(() => {
    if (!data) return [];
    const frame = frameFor(reconstructionMa);
    return species
      .map((s) => ({ id: s.id, sites: speciesSitesInFrame(s.id, data.species[s.id]?.sites ?? [], frame, paleo) }))
      .filter((e) => e.sites.length);
  }, [species, data, paleo, reconstructionMa]);
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
      {/* 点材质无法描边：下层垫一个稍大的墨点作为外圈 */}
      <points geometry={all.geometry} raycast={() => null} renderOrder={1}>
        <pointsMaterial color={INK.ink} size={7} sizeAttenuation={false} depthWrite={false} toneMapped={false} />
      </points>
      <points geometry={all.geometry} onClick={onClick} renderOrder={2}>
        <pointsMaterial vertexColors size={5} sizeAttenuation={false} depthWrite={false} toneMapped={false} />
      </points>
      {selected.owners.length > 0 && (
        <>
          <points geometry={selected.geometry} raycast={() => null} renderOrder={3}>
            <pointsMaterial color={INK.ink} size={13} sizeAttenuation={false} depthWrite={false} toneMapped={false} />
          </points>
          <points geometry={selected.geometry} raycast={() => null} renderOrder={4}>
            <pointsMaterial color={INK.mark} size={9} sizeAttenuation={false} depthWrite={false} toneMapped={false} />
          </points>
        </>
      )}
    </group>
  );
}
