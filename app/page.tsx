"use client";

import {
  Canvas,
  ThreeEvent,
  useFrame,
  useThree,
} from "@react-three/fiber";
import {
  ContactShadows,
  Environment,
  Line,
  OrbitControls,
  PerspectiveCamera,
  Text,
} from "@react-three/drei";
import {
  AlertTriangle,
  Armchair,
  ArrowDownToLine,
  Box,
  Check,
  ChevronDown,
  Cloud,
  CloudFog,
  CloudRain,
  CloudSun,
  Copy,
  Download,
  Flame,
  Footprints,
  FolderOpen,
  Grid3X3,
  Home,
  LampDesk,
  Menu,
  MoreHorizontal,
  Moon,
  MousePointer2,
  Move3D,
  Package,
  Plus,
  Redo2,
  RotateCw,
  Save,
  Search,
  Settings2,
  Sparkles,
  Sun,
  TentTree,
  Trash2,
  Undo2,
  Upload,
  Umbrella,
  Wind,
  X,
} from "lucide-react";
import { createStore } from "zustand/vanilla";
import {
  ChangeEvent,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import * as THREE from "three";

type Category = "宿泊" | "日よけ" | "火まわり" | "家具" | "照明" | "その他";
type Weather = "晴れ" | "曇り" | "雨" | "霧";
type Season = "春" | "夏" | "秋" | "冬";
type GroundType = "芝生" | "土" | "砂利" | "砂" | "森林" | "河原";
type TerrainType = "平坦" | "少し傾斜" | "中央が高い" | "中央が低い" | "一部に水たまり" | "川沿い";
type ToolMode = "select" | "move" | "rotate";

interface ItemDefinition {
  type: string;
  name: string;
  category: Category;
  size: [number, number, number];
  color: string;
  kind: "tent" | "tarp" | "fire" | "table" | "chair" | "light" | "car" | "tree" | "box" | "hammock";
  safetyRadius?: number;
}

interface CampItem {
  id: string;
  type: string;
  name: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
  safetyRadius?: number;
  lightOn?: boolean;
  brightness?: number;
  lightColor?: string;
}

interface CampSiteState {
  title: string;
  width: number;
  depth: number;
  groundType: GroundType;
  terrainType: TerrainType;
  weather: Weather;
  windDirection: number;
  windSpeed: number;
  time: number;
  season: Season;
  snap: number;
  angleSnap: number;
  items: CampItem[];
}

interface EditorStore extends CampSiteState {
  selectedId: string | null;
  past: CampItem[][];
  future: CampItem[][];
  addItem: (definition: ItemDefinition) => void;
  updateItem: (id: string, patch: Partial<CampItem>, record?: boolean) => void;
  removeSelected: () => void;
  duplicateSelected: () => void;
  select: (id: string | null) => void;
  remember: () => void;
  undo: () => void;
  redo: () => void;
  setSite: (patch: Partial<CampSiteState>) => void;
  replaceSite: (site: CampSiteState) => void;
}

const uid = () => Math.random().toString(36).slice(2, 9);

const ITEM_DEFINITIONS: ItemDefinition[] = [
  { type: "solo-tent", name: "ソロテント", category: "宿泊", size: [2.2, 1.35, 1.6], color: "#d7a24a", kind: "tent" },
  { type: "dome-tent", name: "ドームテント", category: "宿泊", size: [3.2, 1.8, 2.6], color: "#c9783d", kind: "tent" },
  { type: "one-pole-tent", name: "ワンポールテント", category: "宿泊", size: [3.6, 2.5, 3.6], color: "#92714d", kind: "tent" },
  { type: "two-room-tent", name: "ツールームテント", category: "宿泊", size: [5.4, 2.1, 3.2], color: "#7c8b63", kind: "tent" },
  { type: "camping-car", name: "車中泊用車両", category: "宿泊", size: [4.6, 1.9, 2], color: "#d4d0c5", kind: "car" },
  { type: "cot", name: "コット", category: "宿泊", size: [1.9, 0.45, 0.7], color: "#7d735e", kind: "box" },
  { type: "hammock", name: "ハンモック", category: "宿泊", size: [3.2, 1.25, 1], color: "#d98e63", kind: "hammock" },
  { type: "hexa-tarp", name: "ヘキサタープ", category: "日よけ", size: [4.6, 2.2, 4.2], color: "#b69b6c", kind: "tarp" },
  { type: "recta-tarp", name: "レクタタープ", category: "日よけ", size: [5, 2.3, 4], color: "#9d9a6b", kind: "tarp" },
  { type: "screen-tarp", name: "スクリーンタープ", category: "日よけ", size: [4.2, 2.2, 3.8], color: "#78856e", kind: "tarp" },
  { type: "side-wall", name: "サイドウォール", category: "日よけ", size: [3.5, 1.8, 0.12], color: "#aaa17c", kind: "box" },
  { type: "fire-pit", name: "焚き火台", category: "火まわり", size: [0.8, 0.55, 0.8], color: "#353a35", kind: "fire", safetyRadius: 2 },
  { type: "wood-rack", name: "薪置き", category: "火まわり", size: [1.1, 0.55, 0.55], color: "#785036", kind: "box" },
  { type: "ash-pot", name: "火消し壺", category: "火まわり", size: [0.42, 0.55, 0.42], color: "#343b3b", kind: "box" },
  { type: "bbq", name: "BBQグリル", category: "火まわり", size: [1.2, 0.9, 0.6], color: "#303735", kind: "fire", safetyRadius: 1.5 },
  { type: "gas-stove", name: "ガスコンロ", category: "火まわり", size: [0.55, 0.25, 0.4], color: "#a4a59e", kind: "fire", safetyRadius: 1 },
  { type: "low-table", name: "ローテーブル", category: "家具", size: [1.25, 0.42, 0.7], color: "#92663f", kind: "table" },
  { type: "high-table", name: "ハイテーブル", category: "家具", size: [1.35, 0.78, 0.72], color: "#7c5437", kind: "table" },
  { type: "chair", name: "チェア", category: "家具", size: [0.65, 0.8, 0.65], color: "#b26d43", kind: "chair" },
  { type: "bench", name: "ベンチ", category: "家具", size: [1.5, 0.7, 0.55], color: "#936543", kind: "chair" },
  { type: "rack", name: "ラック", category: "家具", size: [1.15, 1.3, 0.45], color: "#6f604b", kind: "box" },
  { type: "cooler", name: "クーラーボックス", category: "家具", size: [0.85, 0.55, 0.48], color: "#6f8b83", kind: "box" },
  { type: "storage", name: "収納ボックス", category: "家具", size: [0.78, 0.48, 0.52], color: "#927b58", kind: "box" },
  { type: "lantern", name: "ランタン", category: "照明", size: [0.28, 0.55, 0.28], color: "#dab970", kind: "light" },
  { type: "led-light", name: "LEDライト", category: "照明", size: [0.35, 0.18, 0.22], color: "#e2d8bc", kind: "light" },
  { type: "pole-light", name: "ポールライト", category: "照明", size: [0.35, 2.15, 0.35], color: "#d8ba74", kind: "light" },
  { type: "tent-light", name: "テントライト", category: "照明", size: [0.25, 0.25, 0.25], color: "#e6ce91", kind: "light" },
  { type: "trash", name: "ゴミ箱", category: "その他", size: [0.55, 0.8, 0.55], color: "#667164", kind: "box" },
  { type: "water", name: "ウォータージャグ", category: "その他", size: [0.5, 0.6, 0.5], color: "#819ca2", kind: "box" },
  { type: "sink", name: "洗い場", category: "その他", size: [1.2, 1, 0.65], color: "#929792", kind: "table" },
  { type: "car", name: "車", category: "その他", size: [4.3, 1.65, 1.85], color: "#aab2ad", kind: "car" },
  { type: "bike", name: "自転車", category: "その他", size: [1.75, 1.1, 0.45], color: "#394747", kind: "box" },
  { type: "pet-circle", name: "ペット用サークル", category: "その他", size: [2.2, 0.75, 2.2], color: "#8b7861", kind: "box" },
  { type: "tree", name: "木", category: "その他", size: [1.4, 4.2, 1.4], color: "#4f714d", kind: "tree" },
];

const defFor = (type: string) => ITEM_DEFINITIONS.find((d) => d.type === type) ?? ITEM_DEFINITIONS[0];

const makeItem = (type: string, x: number, z: number, rotation = 0): CampItem => {
  const definition = defFor(type);
  return {
    id: uid(),
    type,
    name: definition.name,
    position: { x, y: 0, z },
    rotation: { x: 0, y: rotation, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    safetyRadius: definition.safetyRadius,
    lightOn: definition.kind === "light",
    brightness: 1,
    lightColor: "#ffd58a",
  };
};

const initialItems = [
  makeItem("dome-tent", -2.4, -2.2, -0.15),
  makeItem("hexa-tarp", 1.5, 0.2, 0.08),
  makeItem("low-table", 1.2, 0.1),
  makeItem("chair", 1.1, 1.1, Math.PI),
  makeItem("chair", 2.1, 0.2, -Math.PI / 2),
  makeItem("fire-pit", 2.8, 2.25),
  makeItem("cooler", -0.1, 1.5, 0.1),
  makeItem("pole-light", -0.15, -0.2),
  makeItem("car", -3, 3.25, Math.PI / 2),
  makeItem("tree", 4.1, -3.6),
];

const SAMPLE_SITES: Record<string, CampSiteState> = {
  ソロキャンプ: { title: "森のソロキャンプ", width: 8, depth: 8, groundType: "森林", terrainType: "平坦", weather: "晴れ", windDirection: 45, windSpeed: 1, time: 16, season: "秋", snap: 0.25, angleSnap: 15, items: [makeItem("solo-tent", -1.5, -1.5), makeItem("hexa-tarp", 1, 0), makeItem("fire-pit", 2.2, 2), makeItem("chair", 1.2, 1.5), makeItem("low-table", 0.5, 1.2), makeItem("lantern", 0, 0)] },
  ファミリー: { title: "週末ファミリーサイト", width: 10, depth: 15, groundType: "芝生", terrainType: "少し傾斜", weather: "晴れ", windDirection: 90, windSpeed: 2, time: 14, season: "夏", snap: 0.5, angleSnap: 15, items: [makeItem("two-room-tent", -2, -3), makeItem("recta-tarp", 1.7, 1), makeItem("fire-pit", 3, 4), makeItem("high-table", 1.4, 1), makeItem("chair", 0, 2), makeItem("chair", 2, 2), makeItem("cooler", 3.4, 0), makeItem("car", -3, 5)] },
  雨キャンプ: { title: "雨をしのぐ河原サイト", width: 10, depth: 10, groundType: "河原", terrainType: "一部に水たまり", weather: "雨", windDirection: 220, windSpeed: 2, time: 17, season: "春", snap: 0.25, angleSnap: 15, items: [makeItem("dome-tent", -2.3, -2.2), makeItem("screen-tarp", 1.2, 0.2), makeItem("low-table", 1, 0.5), makeItem("gas-stove", 2.1, 0.4), makeItem("cooler", -0.3, 1.6), makeItem("pole-light", -0.2, -0.2), makeItem("car", -3.2, 3.6)] },
};

const editorStore = createStore<EditorStore>()((set, get) => ({
  title: "森の週末サイト",
  width: 10,
  depth: 10,
  groundType: "芝生",
  terrainType: "少し傾斜",
  weather: "晴れ",
  windDirection: 45,
  windSpeed: 1,
  time: 16,
  season: "秋",
  snap: 0.25,
  angleSnap: 15,
  items: initialItems,
  selectedId: initialItems[2].id,
  past: [],
  future: [],
  addItem: (definition) => {
    const state = get();
    const offset = state.items.length * 0.17;
    const item = makeItem(definition.type, Math.min(2, -0.4 + offset), Math.min(2, -0.4 + offset));
    set({ items: [...state.items, item], selectedId: item.id, past: [...state.past.slice(-30), state.items], future: [] });
  },
  updateItem: (id, patch, record = false) => {
    const state = get();
    set({
      items: state.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
      ...(record ? { past: [...state.past.slice(-30), state.items], future: [] } : {}),
    });
  },
  removeSelected: () => {
    const state = get();
    if (!state.selectedId) return;
    set({ items: state.items.filter((item) => item.id !== state.selectedId), selectedId: null, past: [...state.past.slice(-30), state.items], future: [] });
  },
  duplicateSelected: () => {
    const state = get();
    const selected = state.items.find((item) => item.id === state.selectedId);
    if (!selected) return;
    const copy = { ...selected, id: uid(), name: `${selected.name} コピー`, position: { ...selected.position, x: selected.position.x + 0.6, z: selected.position.z + 0.6 } };
    set({ items: [...state.items, copy], selectedId: copy.id, past: [...state.past.slice(-30), state.items], future: [] });
  },
  select: (id) => set({ selectedId: id }),
  remember: () => {
    const state = get();
    set({ past: [...state.past.slice(-30), state.items], future: [] });
  },
  undo: () => {
    const state = get();
    const previous = state.past[state.past.length - 1];
    if (!previous) return;
    set({ items: previous, past: state.past.slice(0, -1), future: [state.items, ...state.future].slice(0, 30), selectedId: null });
  },
  redo: () => {
    const state = get();
    const next = state.future[0];
    if (!next) return;
    set({ items: next, past: [...state.past, state.items].slice(-30), future: state.future.slice(1), selectedId: null });
  },
  setSite: (patch) => set(patch),
  replaceSite: (site) => set({ ...site, selectedId: null, past: [], future: [] }),
}));

function useEditor<T = EditorStore>(selector?: (state: EditorStore) => T): T {
  const pick = selector ?? ((state: EditorStore) => state as unknown as T);
  return useSyncExternalStore(
    editorStore.subscribe,
    () => pick(editorStore.getState()),
    () => pick(editorStore.getInitialState()),
  );
}

function siteFromStore(state: EditorStore): CampSiteState {
  return {
    title: state.title,
    width: state.width,
    depth: state.depth,
    groundType: state.groundType,
    terrainType: state.terrainType,
    weather: state.weather,
    windDirection: state.windDirection,
    windSpeed: state.windSpeed,
    time: state.time,
    season: state.season,
    snap: state.snap,
    angleSnap: state.angleSnap,
    items: state.items,
  };
}

function getCollisions(items: CampItem[], width: number, depth: number) {
  const ids = new Set<string>();
  const outside = new Set<string>();
  items.forEach((item) => {
    const def = defFor(item.type);
    const w = def.size[0] * item.scale.x;
    const d = def.size[2] * item.scale.z;
    if (Math.abs(item.position.x) + w / 2 > width / 2 || Math.abs(item.position.z) + d / 2 > depth / 2) outside.add(item.id);
  });
  for (let i = 0; i < items.length; i += 1) {
    const a = items[i];
    const ad = defFor(a.type);
    if (["tarp", "light", "tree"].includes(ad.kind)) continue;
    for (let j = i + 1; j < items.length; j += 1) {
      const b = items[j];
      const bd = defFor(b.type);
      if (["tarp", "light", "tree"].includes(bd.kind)) continue;
      const overlapX = Math.abs(a.position.x - b.position.x) < (ad.size[0] * a.scale.x + bd.size[0] * b.scale.x) * 0.38;
      const overlapZ = Math.abs(a.position.z - b.position.z) < (ad.size[2] * a.scale.z + bd.size[2] * b.scale.z) * 0.38;
      if (overlapX && overlapZ) { ids.add(a.id); ids.add(b.id); }
    }
  }
  return { collisions: ids, outside };
}

function getSafetyWarnings(items: CampItem[]) {
  const warned = new Set<string>();
  const fireItems = items.filter((item) => defFor(item.type).kind === "fire");
  fireItems.forEach((fire) => {
    items.forEach((other) => {
      if (fire.id === other.id) return;
      const kind = defFor(other.type).kind;
      if (!["tent", "tarp", "car", "tree", "chair"].includes(kind)) return;
      const distance = Math.hypot(fire.position.x - other.position.x, fire.position.z - other.position.z);
      if (distance < (fire.safetyRadius ?? 2) + Math.max(defFor(other.type).size[0], defFor(other.type).size[2]) * 0.3) warned.add(fire.id);
    });
  });
  return warned;
}

function scoreSite(site: CampSiteState) {
  const { collisions, outside } = getCollisions(site.items, site.width, site.depth);
  const safety = getSafetyWarnings(site.items);
  const tents = site.items.filter((item) => defFor(item.type).kind === "tent");
  const lights = site.items.filter((item) => defFor(item.type).kind === "light" && item.lightOn);
  const fire = site.items.filter((item) => defFor(item.type).kind === "fire");
  const tarps = site.items.filter((item) => defFor(item.type).kind === "tarp");
  const hasCar = site.items.some((item) => defFor(item.type).kind === "car");
  const rainRisk = (site.weather === "雨" || site.terrainType.includes("低い") || site.terrainType.includes("水たまり")) && tents.some((tent) => tent.position.x > -0.8 && tent.position.x < 1.6 && tent.position.z > 1 && tent.position.z < 3);
  const safetyScore = Math.max(8, 30 - collisions.size * 2 - outside.size * 4 - safety.size * 6);
  const movementScore = Math.max(8, 20 - collisions.size * 2 - (site.items.length > 18 ? 4 : 0));
  const smokeScore = Math.max(4, 15 - safety.size * 5);
  const shadeScore = tarps.length ? 10 : 5;
  const lightScore = lights.length >= 2 ? 10 : lights.length ? 7 : 3;
  const rainScore = rainRisk ? 4 : 10;
  const useScore = Math.min(5, Math.round((site.items.length / Math.max(8, site.width * site.depth / 10)) * 5));
  const total = safetyScore + movementScore + smokeScore + shadeScore + lightScore + rainScore + useScore;
  const tips: string[] = [];
  if (safety.size) tips.push("焚き火まわりの安全距離が不足しています。火器をテントやタープから離しましょう。");
  if (outside.size) tips.push("区画の外に出ているアイテムがあります。境界線の内側へ移動してください。");
  if (collisions.size) tips.push("アイテム同士が重なっています。動線を確保するため間隔を広げましょう。");
  if (!tarps.length) tips.push("日中の居場所にタープを追加すると、日陰の評価が上がります。");
  if (!lights.length) tips.push("夜間の足元を照らすライトを1つ以上追加しましょう。");
  if (rainRisk) tips.push("テントが水のたまりやすい位置にあります。区画の西側へ移動してみましょう。");
  if (!hasCar) tips.push("荷運びの動線を確認するため、駐車位置を追加すると便利です。");
  if (!fire.length) tips.push("火器を使う場合は焚き火台を追加し、安全半径を確認してください。");
  if (!tips.length) tips.push("安全性と動線のバランスが良いレイアウトです。夜景でも最終確認しましょう。");
  return { total: Math.min(100, total), safetyScore, movementScore, smokeScore, shadeScore, lightScore, rainScore, useScore, tips, rainRisk };
}

function PrimitiveItem({ item, selected, collision, outside, onSelect }: { item: CampItem; selected: boolean; collision: boolean; outside: boolean; onSelect: () => void }) {
  const definition = defFor(item.type);
  const group = useRef<THREE.Group>(null);
  const dragging = useRef(false);
  const remembered = useRef(false);
  const updateItem = useEditor((state) => state.updateItem);
  const remember = useEditor((state) => state.remember);
  const snap = useEditor((state) => state.snap);
  const angleSnap = useEditor((state) => state.angleSnap);
  const selectedId = useEditor((state) => state.selectedId);
  const isDanger = collision || outside;

  const moveItem = (event: ThreeEvent<PointerEvent>) => {
    if (!dragging.current || selectedId !== item.id) return;
    event.stopPropagation();
    const point = new THREE.Vector3();
    event.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), point);
    const round = (value: number) => snap ? Math.round(value / snap) * snap : value;
    if (event.shiftKey) {
      updateItem(item.id, { position: { ...item.position, y: Math.max(0, item.position.y - (event.nativeEvent.movementY || 0) * 0.02) } });
    } else {
      updateItem(item.id, { position: { ...item.position, x: round(point.x), z: round(point.z) } });
    }
  };

  const common = { castShadow: true, receiveShadow: true };
  const matColor = isDanger ? "#e14e3f" : definition.color;
  let model: ReactNode;
  if (definition.kind === "tent") {
    model = <>
      <mesh {...common} position={[0, definition.size[1] * 0.36, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[Math.max(definition.size[0], definition.size[2]) * 0.58, definition.size[1], 4]} />
        <meshStandardMaterial color={matColor} roughness={0.82} />
      </mesh>
      <mesh position={[0, definition.size[1] * 0.35, definition.size[2] * 0.39]}>
        <planeGeometry args={[definition.size[0] * 0.35, definition.size[1] * 0.58]} />
        <meshStandardMaterial color="#2d332d" side={THREE.DoubleSide} />
      </mesh>
    </>;
  } else if (definition.kind === "tarp") {
    model = <>
      <mesh {...common} position={[0, definition.size[1], 0]} rotation={[-0.03, 0, 0]}>
        <boxGeometry args={[definition.size[0], 0.06, definition.size[2]]} />
        <meshStandardMaterial color={matColor} roughness={0.9} transparent opacity={0.88} />
      </mesh>
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z], index) => <mesh key={index} position={[x * definition.size[0] * 0.47, definition.size[1] / 2, z * definition.size[2] * 0.47]} castShadow><cylinderGeometry args={[0.035, 0.035, definition.size[1], 8]} /><meshStandardMaterial color="#514a3c" /></mesh>)}
    </>;
  } else if (definition.kind === "fire") {
    model = <>
      <mesh {...common} position={[0, 0.24, 0]}><cylinderGeometry args={[0.42, 0.34, 0.38, 8]} /><meshStandardMaterial color={matColor} metalness={0.65} roughness={0.38} /></mesh>
      <mesh position={[0, 0.62, 0]}><coneGeometry args={[0.22, 0.7, 8]} /><meshStandardMaterial color="#ff8b37" emissive="#f04418" emissiveIntensity={2} transparent opacity={0.92} /></mesh>
      <pointLight position={[0, 0.9, 0]} color="#ff7b2e" intensity={2.2} distance={4} />
    </>;
  } else if (definition.kind === "table") {
    model = <>
      <mesh {...common} position={[0, definition.size[1], 0]}><boxGeometry args={[definition.size[0], 0.12, definition.size[2]]} /><meshStandardMaterial color={matColor} /></mesh>
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z], index) => <mesh key={index} position={[x * definition.size[0] * 0.39, definition.size[1] / 2, z * definition.size[2] * 0.36]} castShadow><boxGeometry args={[0.08, definition.size[1], 0.08]} /><meshStandardMaterial color="#493a2e" /></mesh>)}
    </>;
  } else if (definition.kind === "chair") {
    model = <>
      <mesh {...common} position={[0, 0.42, 0]}><boxGeometry args={[definition.size[0], 0.1, definition.size[2]]} /><meshStandardMaterial color={matColor} /></mesh>
      <mesh {...common} position={[0, 0.75, -definition.size[2] * 0.4]} rotation={[-0.15, 0, 0]}><boxGeometry args={[definition.size[0], 0.72, 0.08]} /><meshStandardMaterial color={matColor} /></mesh>
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z], index) => <mesh key={index} position={[x * 0.23, 0.2, z * 0.2]}><cylinderGeometry args={[0.025, 0.025, 0.42, 6]} /><meshStandardMaterial color="#3e403d" /></mesh>)}
    </>;
  } else if (definition.kind === "light") {
    model = <>
      {definition.type === "pole-light" && <mesh position={[0, 1, 0]} castShadow><cylinderGeometry args={[0.025, 0.03, 2, 8]} /><meshStandardMaterial color="#343b38" /></mesh>}
      <mesh position={[0, definition.type === "pole-light" ? 2 : 0.38, 0]} castShadow><cylinderGeometry args={[0.16, 0.13, 0.3, 10]} /><meshStandardMaterial color={item.lightColor} emissive={item.lightOn ? item.lightColor : "#000000"} emissiveIntensity={item.lightOn ? 2.5 : 0} /></mesh>
      {item.lightOn && <pointLight position={[0, definition.type === "pole-light" ? 1.85 : 0.5, 0]} color={item.lightColor} intensity={(item.brightness ?? 1) * 3} distance={6 + (item.brightness ?? 1) * 2} castShadow={false} />}
    </>;
  } else if (definition.kind === "car") {
    model = <>
      <mesh {...common} position={[0, 0.62, 0]}><boxGeometry args={[definition.size[0], 0.82, definition.size[2]]} /><meshStandardMaterial color={matColor} metalness={0.35} roughness={0.48} /></mesh>
      <mesh {...common} position={[-0.35, 1.22, 0]}><boxGeometry args={[definition.size[0] * 0.52, 0.58, definition.size[2] * 0.84]} /><meshStandardMaterial color={matColor} metalness={0.3} roughness={0.45} /></mesh>
      {[[-1.3, -1], [1.3, -1], [-1.3, 1], [1.3, 1]].map(([x, z], index) => <mesh key={index} position={[x, 0.38, z * definition.size[2] * 0.49]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.36, 0.36, 0.2, 12]} /><meshStandardMaterial color="#242827" /></mesh>)}
    </>;
  } else if (definition.kind === "tree") {
    model = <>
      <mesh position={[0, 1.2, 0]} castShadow><cylinderGeometry args={[0.2, 0.32, 2.4, 9]} /><meshStandardMaterial color="#67503d" /></mesh>
      <mesh position={[0, 3.1, 0]} castShadow><coneGeometry args={[1.25, 3.2, 9]} /><meshStandardMaterial color={matColor} roughness={1} /></mesh>
    </>;
  } else if (definition.kind === "hammock") {
    model = <>
      <mesh position={[-1.35, 0.9, 0]}><cylinderGeometry args={[0.07, 0.08, 1.8, 8]} /><meshStandardMaterial color="#604a37" /></mesh>
      <mesh position={[1.35, 0.9, 0]}><cylinderGeometry args={[0.07, 0.08, 1.8, 8]} /><meshStandardMaterial color="#604a37" /></mesh>
      <mesh position={[0, 1.05, 0]} rotation={[0, 0, 0.08]}><boxGeometry args={[2.4, 0.08, 0.8]} /><meshStandardMaterial color={matColor} /></mesh>
    </>;
  } else {
    model = <mesh {...common} position={[0, definition.size[1] / 2, 0]}><boxGeometry args={definition.size} /><meshStandardMaterial color={matColor} roughness={0.75} /></mesh>;
  }

  return <group
    ref={group}
    position={[item.position.x, item.position.y, item.position.z]}
    rotation={[item.rotation.x, item.rotation.y, item.rotation.z]}
    scale={[item.scale.x, item.scale.y, item.scale.z]}
    onPointerDown={(event) => {
      event.stopPropagation();
      onSelect();
      if (!remembered.current) { remember(); remembered.current = true; }
      dragging.current = true;
      (event.target as unknown as { setPointerCapture?: (id: number) => void }).setPointerCapture?.(event.pointerId);
    }}
    onPointerMove={moveItem}
    onPointerUp={(event) => {
      dragging.current = false;
      remembered.current = false;
      (event.target as unknown as { releasePointerCapture?: (id: number) => void }).releasePointerCapture?.(event.pointerId);
    }}
    onWheel={(event) => {
      if (!selected) return;
      event.stopPropagation();
      const step = angleSnap ? THREE.MathUtils.degToRad(angleSnap) : 0.08;
      updateItem(item.id, { rotation: { ...item.rotation, y: item.rotation.y + (event.deltaY > 0 ? step : -step) } }, true);
    }}
  >
    {selected && <mesh position={[0, 0.025, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[Math.max(definition.size[0], definition.size[2]) * 0.58, Math.max(definition.size[0], definition.size[2]) * 0.62, 48]} />
      <meshBasicMaterial color={isDanger ? "#ff4d3f" : "#e9b949"} transparent opacity={0.95} depthWrite={false} />
    </mesh>}
    {selected && definition.kind === "fire" && <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[item.safetyRadius ?? 2, 64]} />
      <meshBasicMaterial color={isDanger ? "#f25042" : "#f4a43b"} transparent opacity={0.2} depthWrite={false} />
    </mesh>}
    {model}
  </group>;
}

function Smoke({ item, direction, speed }: { item: CampItem; direction: number; speed: number }) {
  const group = useRef<THREE.Group>(null);
  const particles = useMemo(() => Array.from({ length: 15 }, (_, i) => ({ x: (i * 0.37) % 4.5, y: 0.5 + ((i * 0.41) % 2.1), z: Math.sin(i * 2.3) * 0.18, size: 0.12 + (i % 4) * 0.035 })), []);
  useFrame((_, delta) => { if (group.current) group.current.position.x = (group.current.position.x + delta * speed * 0.35) % 0.42; });
  return <group ref={group} position={[item.position.x, item.position.y + 0.6, item.position.z]} rotation={[0, THREE.MathUtils.degToRad(-direction), 0]}>
    {particles.map((particle, index) => <mesh key={index} position={[particle.x, particle.y, particle.z]}><sphereGeometry args={[particle.size, 8, 8]} /><meshBasicMaterial color="#d7ddd7" transparent opacity={Math.max(0.08, 0.38 - particle.x * 0.055)} depthWrite={false} /></mesh>)}
  </group>;
}

function Rain() {
  const points = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const array = new Float32Array(900);
    for (let i = 0; i < 300; i += 1) { array[i * 3] = (Math.random() - 0.5) * 18; array[i * 3 + 1] = Math.random() * 10; array[i * 3 + 2] = (Math.random() - 0.5) * 18; }
    return array;
  }, []);
  useFrame((_, delta) => {
    if (!points.current) return;
    const data = points.current.geometry.attributes.position.array as Float32Array;
    for (let i = 1; i < data.length; i += 3) data[i] = data[i] < 0.1 ? 9 : data[i] - delta * 8;
    points.current.geometry.attributes.position.needsUpdate = true;
  });
  return <points ref={points}><bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry><pointsMaterial color="#a9d3e6" size={0.055} transparent opacity={0.72} depthWrite={false} /></points>;
}

function FirstPersonRig({ active }: { active: boolean }) {
  const { camera } = useThree();
  const keys = useRef<Record<string, boolean>>({});
  useEffect(() => {
    if (!active) return;
    camera.position.set(0, 1.65, 5.5);
    camera.lookAt(0, 1.2, 0);
    const down = (event: KeyboardEvent) => { keys.current[event.key.toLowerCase()] = true; };
    const up = (event: KeyboardEvent) => { keys.current[event.key.toLowerCase()] = false; };
    window.addEventListener("keydown", down); window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [active, camera]);
  useFrame((_, delta) => {
    if (!active) return;
    const speed = (keys.current.shift ? 5 : 2.5) * delta;
    const forward = new THREE.Vector3(); camera.getWorldDirection(forward); forward.y = 0; forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
    if (keys.current.w) camera.position.addScaledVector(forward, speed);
    if (keys.current.s) camera.position.addScaledVector(forward, -speed);
    if (keys.current.a) camera.position.addScaledVector(right, -speed);
    if (keys.current.d) camera.position.addScaledVector(right, speed);
    camera.position.y = 1.65;
  });
  return null;
}

function Scene({ firstPerson, onCanvasReady }: { firstPerson: boolean; onCanvasReady: (gl: THREE.WebGLRenderer) => void }) {
  const state = useEditor();
  const { collisions, outside } = useMemo(() => getCollisions(state.items, state.width, state.depth), [state.items, state.width, state.depth]);
  const safety = useMemo(() => getSafetyWarnings(state.items), [state.items]);
  const angle = ((state.time - 6) / 12) * Math.PI;
  const seasonalHeight = { 春: 6, 夏: 8, 秋: 5, 冬: 3 }[state.season];
  const sunPosition: [number, number, number] = [Math.cos(angle) * 10, Math.max(0.6, Math.sin(angle) * seasonalHeight), Math.sin(angle) * -8];
  const night = state.time < 6.5 || state.time > 18.2;
  const groundColors: Record<GroundType, string> = { 芝生: "#66795a", 土: "#806b51", 砂利: "#85877d", 砂: "#a99672", 森林: "#53634d", 河原: "#777c73" };
  const routeStart = state.items.find((item) => defFor(item.type).kind === "car")?.position;
  const routeEnd = state.items.find((item) => defFor(item.type).kind === "tent")?.position;
  const routeColor = collisions.size > 2 ? "#e4594e" : collisions.size ? "#e5b24f" : "#74b874";
  return <>
    <PerspectiveCamera makeDefault position={firstPerson ? [0, 1.65, 5.5] : [10.5, 11, 11.5]} fov={firstPerson ? 68 : 42} />
    <color attach="background" args={[night ? "#111b20" : state.weather === "雨" ? "#8d9999" : state.weather === "曇り" ? "#a8b0a7" : "#b8ccb6"]} />
    <fog attach="fog" args={[state.weather === "霧" ? "#c3cbc5" : night ? "#111b20" : "#b8ccb6", state.weather === "霧" ? 7 : 22, state.weather === "霧" ? 19 : 45]} />
    <ambientLight intensity={night ? 0.17 : state.weather === "曇り" ? 0.75 : 0.55} color={night ? "#7086aa" : "#fff1d5"} />
    <directionalLight position={sunPosition} intensity={night ? 0.12 : state.weather === "曇り" ? 1.1 : 2.25} color={state.time > 17 ? "#ffc47d" : "#fff0cb"} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-12} shadow-camera-right={12} shadow-camera-top={12} shadow-camera-bottom={-12} />
    <Environment preset={night ? "night" : "forest"} environmentIntensity={night ? 0.08 : 0.24} />
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow onPointerDown={() => state.select(null)}>
      <planeGeometry args={[state.width, state.depth, 30, 30]} />
      <meshStandardMaterial color={groundColors[state.groundType]} roughness={1} metalness={state.weather === "雨" ? 0.08 : 0} />
    </mesh>
    <gridHelper args={[Math.max(state.width, state.depth), Math.max(state.width, state.depth) * 2, "#b7aa75", "#8a9278"]} position={[0, 0.015, 0]} />
    <Line points={[[-state.width / 2, 0.035, -state.depth / 2], [state.width / 2, 0.035, -state.depth / 2], [state.width / 2, 0.035, state.depth / 2], [-state.width / 2, 0.035, state.depth / 2], [-state.width / 2, 0.035, -state.depth / 2]]} color="#e6d39b" lineWidth={2} dashed dashSize={0.22} gapSize={0.12} />
    <Text position={[0, 0.06, -state.depth / 2 - 0.45]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.28} color="#eee6ca" anchorX="center">N  ↑</Text>
    {state.items.map((item) => <PrimitiveItem key={item.id} item={item} selected={state.selectedId === item.id} collision={collisions.has(item.id) || safety.has(item.id)} outside={outside.has(item.id)} onSelect={() => state.select(item.id)} />)}
    {state.items.filter((item) => defFor(item.type).kind === "fire").map((item) => <Smoke key={`smoke-${item.id}`} item={item} direction={state.windDirection} speed={Math.max(0.25, state.windSpeed)} />)}
    <group rotation={[0, THREE.MathUtils.degToRad(-state.windDirection), 0]} position={[-state.width / 2 + 1, 0.08, -state.depth / 2 + 1]}>
      <mesh position={[0.55, 0, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.045, 0.045, 1.1, 8]} /><meshBasicMaterial color="#dce7cc" /></mesh>
      <mesh position={[1.15, 0, 0]} rotation={[0, 0, -Math.PI / 2]}><coneGeometry args={[0.18, 0.45, 8]} /><meshBasicMaterial color="#dce7cc" /></mesh>
    </group>
    {routeStart && routeEnd && <Line points={[[routeStart.x, 0.08, routeStart.z], [0, 0.08, 2.3], [routeEnd.x, 0.08, routeEnd.z]]} color={routeColor} lineWidth={3} dashed dashSize={0.25} gapSize={0.14} />}
    {(state.weather === "雨" || state.terrainType.includes("水たまり") || state.terrainType.includes("低い")) && <>
      <mesh position={[0.5, 0.03, 2]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[1.3, 40]} /><meshStandardMaterial color="#5f92a7" transparent opacity={0.46} metalness={0.3} roughness={0.2} /></mesh>
      <mesh position={[-3, 0.035, 0.5]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.72, 32]} /><meshStandardMaterial color="#648fa1" transparent opacity={0.4} /></mesh>
    </>}
    {state.weather === "雨" && <Rain />}
    <ContactShadows position={[0, 0.04, 0]} opacity={night ? 0.18 : 0.35} scale={Math.max(state.width, state.depth) * 1.2} blur={2.2} far={10} />
    <OrbitControls enabled={!firstPerson} makeDefault target={[0, 0.5, 0]} minDistance={6} maxDistance={28} maxPolarAngle={Math.PI / 2.05} />
    <FirstPersonRig active={firstPerson} />
    <RendererReporter onReady={onCanvasReady} />
  </>;
}

function RendererReporter({ onReady }: { onReady: (renderer: THREE.WebGLRenderer) => void }) {
  const { gl } = useThree();
  useEffect(() => onReady(gl), [gl, onReady]);
  return null;
}

function IconButton({ label, children, onClick, active, disabled }: { label: string; children: ReactNode; onClick?: () => void; active?: boolean; disabled?: boolean }) {
  return <button className={`icon-button ${active ? "active" : ""}`} aria-label={label} title={label} onClick={onClick} disabled={disabled}>{children}</button>;
}

function StartCenter({ open, onClose }: { open: boolean; onClose: () => void }) {
  const replaceSite = useEditor((state) => state.replaceSite);
  const [saved, setSaved] = useState<{ name: string; site: CampSiteState; savedAt: string }[]>([]);
  useEffect(() => { try { setSaved(JSON.parse(localStorage.getItem("camp-site-saves") ?? "[]")); } catch { setSaved([]); } }, [open]);
  if (!open) return null;
  const choose = (site: CampSiteState) => { replaceSite(site); onClose(); };
  const blank: CampSiteState = { title: "新しいキャンプサイト", width: 10, depth: 10, groundType: "芝生", terrainType: "平坦", weather: "晴れ", windDirection: 0, windSpeed: 1, time: 12, season: "春", snap: 0.25, angleSnap: 15, items: [] };
  return <div className="modal-backdrop">
    <section className="start-center" role="dialog" aria-modal="true" aria-labelledby="start-title">
      <button className="modal-close" onClick={onClose} aria-label="閉じる"><X size={18} /></button>
      <div className="start-eyebrow"><TentTree size={18} /></div>
      <h2 id="start-title">CAMP SITE BUILDER</h2>
      <div className="start-grid">
        <button className="new-site-card" onClick={() => choose(blank)}><span><Plus size={26} /></span><strong>新しく作る</strong><small>10m × 10m の空サイト</small></button>
        <div className="sample-area">
          <div className="section-caption">サンプルレイアウト</div>
          <div className="sample-grid">
            {Object.entries(SAMPLE_SITES).map(([name, site], index) => <button key={name} onClick={() => choose(site)}>
              <span className={`sample-visual sample-${index + 1}`}><TentTree size={26} /><i /><i /></span>
              <strong>{name}</strong><small>{site.width} × {site.depth}m · {site.items.length}点</small>
            </button>)}
          </div>
        </div>
      </div>
      {saved.length > 0 && <div className="saved-row"><div className="section-caption">保存したレイアウト</div><div className="saved-list">{saved.slice(0, 4).map((entry) => <button key={`${entry.name}-${entry.savedAt}`} onClick={() => choose(entry.site)}><FolderOpen size={16} /><span><strong>{entry.name}</strong><small>{entry.savedAt}</small></span></button>)}</div></div>}
      <div className="start-footer"><span title="ドラッグで配置"><MousePointer2 size={16} /></span><span title="ホイールで回転"><RotateCw size={16} /></span><span title="Shift＋ドラッグで高さ変更"><Move3D size={16} /></span></div>
    </section>
  </div>;
}

function ScorePanel({ score, open, onClose }: { score: ReturnType<typeof scoreSite>; open: boolean; onClose: () => void }) {
  if (!open) return null;
  const rows = [
    ["安全性", score.safetyScore, 30], ["移動しやすさ", score.movementScore, 20], ["火と煙の配置", score.smokeScore, 15], ["日陰の作り方", score.shadeScore, 10], ["夜間の明るさ", score.lightScore, 10], ["雨への強さ", score.rainScore, 10], ["区画の活用率", score.useScore, 5],
  ] as const;
  return <div className="score-popover">
    <div className="score-head"><div><span>サイト評価</span><strong>{score.total}<small>/100</small></strong></div><button onClick={onClose} aria-label="閉じる"><X size={17} /></button></div>
    <div className="score-bars">{rows.map(([name, value, max]) => <div key={name}><span>{name}<b>{value}/{max}</b></span><i><em style={{ width: `${(value / max) * 100}%` }} /></i></div>)}</div>
    <div className="recommendations"><span><Sparkles size={15} /> 改善アドバイス</span>{score.tips.slice(0, 3).map((tip) => <p key={tip}>{tip}</p>)}</div>
  </div>;
}

export default function HomePage() {
  const state = useEditor();
  const [category, setCategory] = useState<Category>("宿泊");
  const [search, setSearch] = useState("");
  const [tool, setTool] = useState<ToolMode>("move");
  const [firstPerson, setFirstPerson] = useState(false);
  const [startOpen, setStartOpen] = useState(false);
  const [scoreOpen, setScoreOpen] = useState(false);
  const [siteSettingsOpen, setSiteSettingsOpen] = useState(false);
  const [mobileLibrary, setMobileLibrary] = useState(false);
  const [savedToast, setSavedToast] = useState("");
  const renderer = useRef<THREE.WebGLRenderer | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const selected = state.items.find((item) => item.id === state.selectedId) ?? null;
  const definition = selected ? defFor(selected.type) : null;
  const collisionData = useMemo(() => getCollisions(state.items, state.width, state.depth), [state.items, state.width, state.depth]);
  const safetyWarnings = useMemo(() => getSafetyWarnings(state.items), [state.items]);
  const score = useMemo(() => scoreSite(siteFromStore(state)), [state.items, state.width, state.depth, state.weather, state.terrainType, state.time, state.windDirection, state.windSpeed, state.season]);
  const filtered = ITEM_DEFINITIONS.filter((item) => item.category === category && item.name.toLowerCase().includes(search.toLowerCase()));
  const warningCount = collisionData.collisions.size + collisionData.outside.size + safetyWarnings.size + (score.rainRisk ? 1 : 0);
  const night = state.time < 6.5 || state.time > 18.2;

  useEffect(() => {
    const timer = window.setTimeout(() => localStorage.setItem("camp-site-autosave", JSON.stringify(siteFromStore(editorStore.getState()))), 450);
    return () => window.clearTimeout(timer);
  }, [state.items, state.width, state.depth, state.groundType, state.terrainType, state.weather, state.windDirection, state.windSpeed, state.time, state.season, state.title]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement)?.tagName;
      if (["INPUT", "SELECT", "TEXTAREA"].includes(tag)) return;
      if (event.key === "Delete" || event.key === "Backspace") state.removeSelected();
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") { event.preventDefault(); state.duplicateSelected(); }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); event.shiftKey ? state.redo() : state.undo(); }
      if (event.key === "Escape") { setFirstPerson(false); state.select(null); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [state]);

  const saveLayout = () => {
    let current: { name: string; site: CampSiteState; savedAt: string }[] = [];
    try { current = JSON.parse(localStorage.getItem("camp-site-saves") ?? "[]"); } catch { current = []; }
    const entry = { name: state.title, site: siteFromStore(state), savedAt: new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date()) };
    localStorage.setItem("camp-site-saves", JSON.stringify([entry, ...current.filter((item) => item.name !== state.title)].slice(0, 12)));
    setSavedToast("ブラウザに保存しました");
    window.setTimeout(() => setSavedToast(""), 2200);
  };

  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(siteFromStore(state), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `${state.title}.json`; a.click(); URL.revokeObjectURL(url);
  };

  const importJson = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    const reader = new FileReader(); reader.onload = () => { try { state.replaceSite(JSON.parse(String(reader.result)) as CampSiteState); setSavedToast("レイアウトを読み込みました"); } catch { setSavedToast("JSONを読み込めませんでした"); } }; reader.readAsText(file); event.target.value = "";
  };

  const exportImage = () => {
    const source = renderer.current?.domElement; if (!source) return;
    const canvas = document.createElement("canvas"); canvas.width = 1600; canvas.height = 1000;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    ctx.fillStyle = "#18211c"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(source, 0, 0, source.width, source.height, 0, 0, 1600, 900);
    const gradient = ctx.createLinearGradient(0, 790, 0, 1000); gradient.addColorStop(0, "transparent"); gradient.addColorStop(0.48, "rgba(18,27,22,.78)"); gradient.addColorStop(1, "#121b16"); ctx.fillStyle = gradient; ctx.fillRect(0, 760, 1600, 240);
    ctx.fillStyle = "#f5f0df"; ctx.font = "700 48px sans-serif"; ctx.fillText(state.title, 58, 920);
    ctx.fillStyle = "#c8c9b7"; ctx.font = "24px sans-serif"; ctx.fillText(`${state.width}×${state.depth}m  ·  ${state.items.length}アイテム  ·  ${state.weather}  ·  風 ${state.windDirection}°  ·  安全性 ${score.total}点`, 60, 964);
    ctx.fillStyle = "#e5b85b"; ctx.font = "700 24px sans-serif"; ctx.textAlign = "right"; ctx.fillText("CAMP SITE BUILDER", 1540, 957);
    const a = document.createElement("a"); a.download = `${state.title}.png`; a.href = canvas.toDataURL("image/png"); a.click();
  };

  return <main className={`app-shell ${firstPerson ? "is-first-person" : ""}`}>
    <header className="topbar">
      <button className="brand" onClick={() => setStartOpen(true)} aria-label="スタート画面" title="Camp Site Builder"><span><TentTree size={21} /></span></button>
      <div className="top-separator" />
      <button className="project-name" onClick={() => setSiteSettingsOpen(true)}><span>{state.title}</span><ChevronDown size={14} /></button>
      <span className="autosave" title="自動保存済み"><Check size={14} /></span>
      <div className="top-actions">
        <div className="history-actions"><IconButton label="元に戻す" onClick={state.undo} disabled={!state.past.length}><Undo2 size={17} /></IconButton><IconButton label="やり直す" onClick={state.redo} disabled={!state.future.length}><Redo2 size={17} /></IconButton></div>
        <button className="warning-pill" onClick={() => setScoreOpen(true)} aria-label={`${warningCount}件の確認`} title="配置警告"><AlertTriangle size={16} />{warningCount > 0 && <b>{warningCount}</b>}</button>
        <button className="score-pill" onClick={() => setScoreOpen((value) => !value)} aria-label={`評価 ${score.total}点`} title="サイト評価"><strong>{score.total}</strong></button>
        <button className="secondary-action" onClick={saveLayout} aria-label="保存" title="保存"><Save size={17} /></button>
        <button className="primary-action" onClick={exportImage} aria-label="画像出力" title="画像出力"><Download size={17} /></button>
        <IconButton label="メニュー" onClick={() => setSiteSettingsOpen((value) => !value)}><Menu size={18} /></IconButton>
      </div>
    </header>

    <aside className={`library-panel ${mobileLibrary ? "mobile-open" : ""}`}>
      <div className="panel-heading"><div><Package size={18} /><small>{ITEM_DEFINITIONS.length}</small></div><button className="mobile-close" onClick={() => setMobileLibrary(false)} aria-label="閉じる"><X size={18} /></button></div>
      <label className="search-field"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="" aria-label="道具を検索" /></label>
      <nav className="category-tabs" aria-label="アイテムカテゴリ">
        {(["宿泊", "日よけ", "火まわり", "家具", "照明", "その他"] as Category[]).map((name) => <button key={name} className={category === name ? "active" : ""} onClick={() => setCategory(name)} aria-label={name} title={name}>{name === "宿泊" ? <TentTree size={17} /> : name === "日よけ" ? <Umbrella size={17} /> : name === "火まわり" ? <Flame size={17} /> : name === "家具" ? <Armchair size={17} /> : name === "照明" ? <LampDesk size={17} /> : <MoreHorizontal size={17} />}</button>)}
      </nav>
      <div className="item-list">
        {filtered.map((item) => <button key={item.type} className="item-card" title={`${item.name} · ${item.size[0]} × ${item.size[2]}m`} aria-label={`${item.name}を追加`} onClick={() => { state.addItem(item); setMobileLibrary(false); }}>
          <span className={`item-thumb kind-${item.kind}`} style={{ "--item-color": item.color } as React.CSSProperties}>
            {item.kind === "tent" ? <TentTree size={27} /> : item.kind === "fire" ? <Flame size={25} /> : item.kind === "light" ? <LampDesk size={24} /> : item.kind === "car" ? <Box size={26} /> : <Package size={25} />}
          </span>
          <Plus size={15} />
        </button>)}
      </div>
    </aside>

    <section className="workspace">
      <div className="view-toolbar">
        <div className="segmented-tools"><IconButton label="選択" active={tool === "select"} onClick={() => setTool("select")}><MousePointer2 size={17} /></IconButton><IconButton label="移動" active={tool === "move"} onClick={() => setTool("move")}><Move3D size={17} /></IconButton><IconButton label="回転" active={tool === "rotate"} onClick={() => setTool("rotate")}><RotateCw size={17} /></IconButton></div>
        <div className="view-label"><button onClick={() => setFirstPerson((value) => !value)} aria-label={firstPerson ? "編集に戻る" : "一人称で歩く"} title={firstPerson ? "編集に戻る" : "一人称で歩く"}>{firstPerson ? <MousePointer2 size={17} /> : <Footprints size={17} />}</button></div>
        <div className="canvas-mini-actions"><button onClick={() => state.setSite({ snap: state.snap ? 0 : 0.25 })} className={state.snap ? "active" : ""} aria-label="スナップ" title={state.snap ? `${state.snap * 100}cm` : "スナップなし"}><Grid3X3 size={15} /></button></div>
      </div>
      <div className="canvas-wrap">
        <Canvas shadows dpr={[1, 1.75]} gl={{ antialias: true, preserveDrawingBuffer: true }}>
          <Scene firstPerson={firstPerson} onCanvasReady={(value) => { renderer.current = value; }} />
        </Canvas>
        {firstPerson && <div className="walk-hud"><span>W A S D</span> 移動 <span>Shift</span> 早歩き <span>Esc</span> 編集へ</div>}
        {!firstPerson && <div className="compass"><b>N</b><i /><span>北</span></div>}
        {warningCount > 0 && !firstPerson && <button className="canvas-warning" onClick={() => setScoreOpen(true)} aria-label={`${warningCount}件の安全・配置警告`} title="配置を確認"><AlertTriangle size={17} /><b>{warningCount}</b></button>}
      </div>
      <div className="environment-dock">
        <div className="env-block time-block"><span className="env-icon">{night ? <Moon size={18} /> : <Sun size={18} />}</span><div><label><b>{String(Math.floor(state.time)).padStart(2, "0")}:{state.time % 1 ? "30" : "00"}</b></label><input aria-label="時刻" type="range" min="5" max="23" step="0.5" value={state.time} onChange={(event) => state.setSite({ time: Number(event.target.value) })} /></div></div>
        <div className="env-divider" />
        <div className="env-block"><span className="env-icon"><Wind size={18} /></span><div><label><b>{state.windDirection}°</b></label><input aria-label="風向き" type="range" min="0" max="359" step="5" value={state.windDirection} onChange={(event) => state.setSite({ windDirection: Number(event.target.value) })} /></div><select aria-label="風速" title="風速" value={state.windSpeed} onChange={(event) => state.setSite({ windSpeed: Number(event.target.value) })}><option value="0">0</option><option value="1">1</option><option value="2">2</option><option value="3">3</option></select></div>
        <div className="env-divider" />
        <div className="env-block weather-block"><div className="weather-switch">{(["晴れ", "曇り", "雨", "霧"] as Weather[]).map((weather) => <button key={weather} className={state.weather === weather ? "active" : ""} onClick={() => state.setSite({ weather })} aria-label={weather} title={weather}>{weather === "晴れ" ? <CloudSun size={16} /> : weather === "曇り" ? <Cloud size={16} /> : weather === "雨" ? <CloudRain size={16} /> : <CloudFog size={16} />}</button>)}</div></div>
      </div>
    </section>

    <aside className="properties-panel">
      {selected && definition ? <>
        <div className="selected-heading"><div className={`selected-thumb kind-${definition.kind}`} style={{ "--item-color": definition.color } as React.CSSProperties}>{definition.kind === "fire" ? <Flame size={24} /> : definition.kind === "tent" ? <TentTree size={25} /> : <Package size={24} />}</div><div><span>選択中</span><input value={selected.name} onChange={(event) => state.updateItem(selected.id, { name: event.target.value })} aria-label="アイテム名" /></div><IconButton label="複製" onClick={state.duplicateSelected}><Copy size={16} /></IconButton></div>
        {(collisionData.collisions.has(selected.id) || collisionData.outside.has(selected.id) || safetyWarnings.has(selected.id)) && <div className="inline-alert"><AlertTriangle size={17} /><span><strong>配置に警告があります</strong><small>{collisionData.outside.has(selected.id) ? "区画の外に出ています" : safetyWarnings.has(selected.id) ? "安全距離が不足しています" : "別のアイテムと重なっています"}</small></span></div>}
        <div className="property-section"><div className="property-title"><span>位置</span><small>m</small></div><div className="triple-fields">{(["x", "y", "z"] as const).map((axis) => <label key={axis}><span>{axis.toUpperCase()}</span><input type="number" step={state.snap || 0.1} value={Number(selected.position[axis].toFixed(2))} onChange={(event) => state.updateItem(selected.id, { position: { ...selected.position, [axis]: Number(event.target.value) } }, true)} /></label>)}</div></div>
        <div className="property-section"><div className="property-title"><span>回転</span><small>degree</small></div><label className="wide-field"><RotateCw size={15} /><input type="range" min="0" max="360" step={state.angleSnap || 1} value={THREE.MathUtils.radToDeg(selected.rotation.y) % 360} onChange={(event) => state.updateItem(selected.id, { rotation: { ...selected.rotation, y: THREE.MathUtils.degToRad(Number(event.target.value)) } })} /><b>{Math.round(THREE.MathUtils.radToDeg(selected.rotation.y) % 360)}°</b></label></div>
        <div className="property-section"><div className="property-title"><span>サイズ</span><small>scale</small></div><label className="wide-field"><Box size={15} /><input type="range" min="0.5" max="2" step="0.05" value={selected.scale.x} onChange={(event) => { const value = Number(event.target.value); state.updateItem(selected.id, { scale: { x: value, y: value, z: value } }); }} /><b>{selected.scale.x.toFixed(2)}×</b></label></div>
        {definition.kind === "fire" && <div className="property-section safety-section"><div className="property-title"><span><Flame size={15} /> 安全範囲</span><small>radius</small></div><label className="wide-field"><span className="safety-dot" /><input type="range" min="0.5" max="5" step="0.25" value={selected.safetyRadius ?? 2} onChange={(event) => state.updateItem(selected.id, { safetyRadius: Number(event.target.value) })} /><b>{selected.safetyRadius ?? 2}m</b></label><p>器具の説明に合わせて変更してください。</p></div>}
        {definition.kind === "light" && <div className="property-section"><div className="property-title"><span><LampDesk size={15} /> 照明</span></div><label className="toggle-row">点灯<input type="checkbox" checked={selected.lightOn} onChange={(event) => state.updateItem(selected.id, { lightOn: event.target.checked })} /><i /></label><label className="wide-field">明るさ<input type="range" min="0.1" max="2" step="0.1" value={selected.brightness} onChange={(event) => state.updateItem(selected.id, { brightness: Number(event.target.value) })} /><b>{selected.brightness?.toFixed(1)}</b></label><label className="color-row">光の色<input type="color" value={selected.lightColor} onChange={(event) => state.updateItem(selected.id, { lightColor: event.target.value })} /></label></div>}
        <div className="property-actions"><button onClick={state.duplicateSelected}><Copy size={16} /> 複製</button><button className="danger" onClick={state.removeSelected}><Trash2 size={16} /> 削除</button></div>
      </> : <>
        <div className="empty-properties"><span><Settings2 size={24} /></span><strong>サイト設定</strong><p>アイテムを選択すると、位置・角度・安全範囲を編集できます。</p></div>
        <div className="property-section"><div className="property-title"><span>区画サイズ</span><small>meter</small></div><div className="double-fields"><label><span>幅</span><input type="number" min="5" max="30" value={state.width} onChange={(event) => state.setSite({ width: Number(event.target.value) })} /></label><label><span>奥行</span><input type="number" min="5" max="40" value={state.depth} onChange={(event) => state.setSite({ depth: Number(event.target.value) })} /></label></div></div>
        <div className="property-section"><div className="property-title"><span>地面と地形</span></div><label className="select-field">地面<select value={state.groundType} onChange={(event) => state.setSite({ groundType: event.target.value as GroundType })}>{["芝生", "土", "砂利", "砂", "森林", "河原"].map((value) => <option key={value}>{value}</option>)}</select></label><label className="select-field">地形<select value={state.terrainType} onChange={(event) => state.setSite({ terrainType: event.target.value as TerrainType })}>{["平坦", "少し傾斜", "中央が高い", "中央が低い", "一部に水たまり", "川沿い"].map((value) => <option key={value}>{value}</option>)}</select></label><label className="select-field">季節<select value={state.season} onChange={(event) => state.setSite({ season: event.target.value as Season })}>{["春", "夏", "秋", "冬"].map((value) => <option key={value}>{value}</option>)}</select></label></div>
        <button className="open-library-mobile" onClick={() => setMobileLibrary(true)}><Plus size={17} /> アイテムを追加</button>
      </>}
    </aside>

    <button className="mobile-add" onClick={() => setMobileLibrary(true)}><Plus size={20} /><span>道具を追加</span></button>
    <ScorePanel score={score} open={scoreOpen} onClose={() => setScoreOpen(false)} />
    <StartCenter open={startOpen} onClose={() => setStartOpen(false)} />
    {siteSettingsOpen && <div className="file-menu">
      <button onClick={() => { setStartOpen(true); setSiteSettingsOpen(false); }}><Home size={16} /> スタート画面</button>
      <button onClick={() => { saveLayout(); setSiteSettingsOpen(false); }}><Save size={16} /> ブラウザに保存</button>
      <button onClick={() => { downloadJson(); setSiteSettingsOpen(false); }}><ArrowDownToLine size={16} /> JSONを書き出す</button>
      <button onClick={() => { fileInput.current?.click(); setSiteSettingsOpen(false); }}><Upload size={16} /> JSONを読み込む</button>
      <button onClick={() => { exportImage(); setSiteSettingsOpen(false); }}><Download size={16} /> PNG画像を書き出す</button>
      <div><span>スナップ</span><select value={state.snap} onChange={(event) => state.setSite({ snap: Number(event.target.value) })}><option value="0">なし</option><option value="0.1">10cm</option><option value="0.25">25cm</option><option value="0.5">50cm</option><option value="1">1m</option></select></div>
      <div><span>角度</span><select value={state.angleSnap} onChange={(event) => state.setSite({ angleSnap: Number(event.target.value) })}><option value="0">自由</option><option value="15">15°</option><option value="45">45°</option><option value="90">90°</option></select></div>
    </div>}
    <input ref={fileInput} className="visually-hidden" type="file" accept="application/json,.json" onChange={importJson} />
    {savedToast && <div className="toast"><Check size={16} /> {savedToast}</div>}
  </main>;
}
