import React, { Suspense, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { USDZLoader } from 'three/examples/jsm/loaders/USDZLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import {
  X,
  Crop,
  Eraser,
  SquareDashedMousePointer,
  Sparkles,
  RotateCcw,
  Undo2,
  Check,
  Move3d,
  Loader2,
  AlertCircle,
  Wand2,
} from 'lucide-react';
import { Button } from '../ui/Button';

export type ScanEditTool = 'crop' | 'brush' | 'boxCut' | 'island' | 'orbit';

interface OriginalGroupRange {
  triStart: number;
  triEnd: number;
  materialIndex?: number;
}

interface EditableMeshRecord {
  mesh: THREE.Mesh;
  originalIndices: Uint32Array;
  originalGroups: OriginalGroupRange[];
  triCount: number;
  /** Triangle centroids in root-group coordinates (length = triCount * 3) */
  centroidsRoot: Float32Array;
  /** Triangle vertex positions in root-group coordinates (length = triCount * 9) */
  vertsRoot: Float32Array;
  /** 1 = alive, 0 = deleted */
  aliveMask: Uint8Array;
}

interface CropPercents {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  zMin: number;
  zMax: number;
}

const DEFAULT_CROP: CropPercents = {
  xMin: 0,
  xMax: 100,
  yMin: 0,
  yMax: 100,
  zMin: 0,
  zMax: 100,
};

const isCropModified = (c: CropPercents) =>
  c.xMin > 0 || c.xMax < 100 || c.yMin > 0 || c.yMax < 100 || c.zMin > 0 || c.zMax < 100;

/** Rebuild a mesh's index buffer from its aliveMask (+ optional live crop filter). */
function rebuildMeshIndexBuffer(
  rec: EditableMeshRecord,
  cropBoundsRoot: THREE.Box3 | null
): number {
  const { mesh, originalIndices, originalGroups, triCount, centroidsRoot, aliveMask } = rec;
  const geom = mesh.geometry as THREE.BufferGeometry;

  const hasCrop = cropBoundsRoot !== null;
  const minX = cropBoundsRoot ? cropBoundsRoot.min.x : -Infinity;
  const maxX = cropBoundsRoot ? cropBoundsRoot.max.x : Infinity;
  const minY = cropBoundsRoot ? cropBoundsRoot.min.y : -Infinity;
  const maxY = cropBoundsRoot ? cropBoundsRoot.max.y : Infinity;
  const minZ = cropBoundsRoot ? cropBoundsRoot.min.z : -Infinity;
  const maxZ = cropBoundsRoot ? cropBoundsRoot.max.z : Infinity;

  const isTriVisible = (t: number): boolean => {
    if (aliveMask[t] === 0) return false;
    if (!hasCrop) return true;
    const i3 = t * 3;
    const cx = centroidsRoot[i3];
    const cy = centroidsRoot[i3 + 1];
    const cz = centroidsRoot[i3 + 2];
    return cx >= minX && cx <= maxX && cy >= minY && cy <= maxY && cz >= minZ && cz <= maxZ;
  };

  let visibleTris = 0;
  for (let t = 0; t < triCount; t++) {
    if (isTriVisible(t)) visibleTris++;
  }

  const nextIndices = new Uint32Array(visibleTris * 3);
  geom.clearGroups();

  if (originalGroups.length > 0) {
    let writeCursor = 0;
    for (const grp of originalGroups) {
      const grpStartIdx = writeCursor;
      const end = Math.min(triCount, grp.triEnd);
      for (let t = Math.max(0, grp.triStart); t < end; t++) {
        if (isTriVisible(t)) {
          const src = t * 3;
          nextIndices[writeCursor++] = originalIndices[src];
          nextIndices[writeCursor++] = originalIndices[src + 1];
          nextIndices[writeCursor++] = originalIndices[src + 2];
        }
      }
      const count = writeCursor - grpStartIdx;
      if (count > 0) {
        geom.addGroup(grpStartIdx, count, grp.materialIndex);
      }
    }
  } else {
    let writeCursor = 0;
    for (let t = 0; t < triCount; t++) {
      if (isTriVisible(t)) {
        const src = t * 3;
        nextIndices[writeCursor++] = originalIndices[src];
        nextIndices[writeCursor++] = originalIndices[src + 1];
        nextIndices[writeCursor++] = originalIndices[src + 2];
      }
    }
  }

  geom.setIndex(new THREE.BufferAttribute(nextIndices, 1));
  geom.computeBoundingSphere();
  mesh.visible = visibleTris > 0;
  return visibleTris;
}

/** Compact a BufferGeometry so deleted vertices are stripped out before exporting. */
function compactGeometry(geom: THREE.BufferGeometry): THREE.BufferGeometry {
  const indexAttr = geom.getIndex();
  if (!indexAttr) return geom.clone();

  const srcIndices = indexAttr.array;
  const indexCount = indexAttr.count;
  const posAttr = geom.getAttribute('position');
  if (!posAttr) return geom.clone();

  const oldVertCount = posAttr.count;
  const oldToNew = new Int32Array(oldVertCount).fill(-1);
  let newVertCount = 0;

  for (let i = 0; i < indexCount; i++) {
    const oldIdx = srcIndices[i];
    if (oldToNew[oldIdx] === -1) {
      oldToNew[oldIdx] = newVertCount++;
    }
  }

  const nextGeom = new THREE.BufferGeometry();

  for (const attrName of Object.keys(geom.attributes)) {
    const attr = geom.getAttribute(attrName) as THREE.BufferAttribute;
    if (!attr || !attr.array) continue;
    const itemSize = attr.itemSize;
    const ArrayCtor = attr.array.constructor as any;
    const nextArr = new ArrayCtor(newVertCount * itemSize);

    for (let oldIdx = 0; oldIdx < oldVertCount; oldIdx++) {
      const newIdx = oldToNew[oldIdx];
      if (newIdx === -1) continue;
      const srcOff = oldIdx * itemSize;
      const dstOff = newIdx * itemSize;
      for (let k = 0; k < itemSize; k++) {
        nextArr[dstOff + k] = attr.array[srcOff + k];
      }
    }

    nextGeom.setAttribute(attrName, new THREE.BufferAttribute(nextArr, itemSize, attr.normalized));
  }

  const newIndices = newVertCount > 65535 ? new Uint32Array(indexCount) : new Uint16Array(indexCount);
  for (let i = 0; i < indexCount; i++) {
    newIndices[i] = oldToNew[srcIndices[i]];
  }
  nextGeom.setIndex(new THREE.BufferAttribute(newIndices, 1));

  for (const grp of geom.groups) {
    nextGeom.addGroup(grp.start, grp.count, grp.materialIndex);
  }

  nextGeom.computeBoundingBox();
  nextGeom.computeBoundingSphere();
  return nextGeom;
}

/** Spatial Union-Find over currently alive triangles across all mesh records. */
function computeConnectedComponents(
  records: EditableMeshRecord[],
  rootBox: THREE.Box3
): {
  globalIslandIds: Int32Array[];
  islandSizes: Map<number, number>;
} {
  let totalTris = 0;
  const offsets: number[] = [];
  for (const rec of records) {
    offsets.push(totalTris);
    totalTris += rec.triCount;
  }

  const parent = new Int32Array(totalTris);
  for (let i = 0; i < totalTris; i++) parent[i] = i;

  const find = (x: number): number => {
    let root = x;
    while (parent[root] !== root) root = parent[root];
    let cur = x;
    while (cur !== root) {
      const nxt = parent[cur];
      parent[cur] = root;
      cur = nxt;
    }
    return root;
  };

  const unite = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };

  const sizeVec = rootBox.getSize(new THREE.Vector3());
  const maxDim = Math.max(sizeVec.x, sizeVec.y, sizeVec.z, 1e-4);
  const invCell = 1 / (maxDim * 0.002); // ~2mm weld tolerance on a 1m garment
  const minX = rootBox.min.x;
  const minY = rootBox.min.y;
  const minZ = rootBox.min.z;

  const spatialFirstTri = new Map<string, number>();

  for (let rIdx = 0; rIdx < records.length; rIdx++) {
    const rec = records[rIdx];
    const baseOffset = offsets[rIdx];
    const { triCount, aliveMask, vertsRoot } = rec;

    for (let t = 0; t < triCount; t++) {
      if (aliveMask[t] === 0) continue;
      const globalTri = baseOffset + t;
      const vBase = t * 9;

      for (let v = 0; v < 3; v++) {
        const vx = vertsRoot[vBase + v * 3];
        const vy = vertsRoot[vBase + v * 3 + 1];
        const vz = vertsRoot[vBase + v * 3 + 2];
        const gx = Math.round((vx - minX) * invCell);
        const gy = Math.round((vy - minY) * invCell);
        const gz = Math.round((vz - minZ) * invCell);
        const key = `${gx},${gy},${gz}`;
        const existing = spatialFirstTri.get(key);
        if (existing === undefined) {
          spatialFirstTri.set(key, globalTri);
        } else {
          unite(existing, globalTri);
        }
      }
    }
  }

  const islandSizes = new Map<number, number>();
  const globalIslandIds: Int32Array[] = [];

  for (let rIdx = 0; rIdx < records.length; rIdx++) {
    const rec = records[rIdx];
    const baseOffset = offsets[rIdx];
    const arr = new Int32Array(rec.triCount).fill(-1);
    for (let t = 0; t < rec.triCount; t++) {
      if (rec.aliveMask[t] === 0) continue;
      const rootId = find(baseOffset + t);
      arr[t] = rootId;
      islandSizes.set(rootId, (islandSizes.get(rootId) || 0) + 1);
    }
    globalIslandIds.push(arr);
  }

  return { globalIslandIds, islandSizes };
}

/** Inner R3F Scene that handles 3D display, crop wireframe, brush raycasting, and screen box projection. */
function EditorViewportScene({
  rootGroup,
  displayScale,
  displayOffset,
  activeTool,
  cropBoundsRoot,
  brushRadiusWorld,
  onBrushStrokeAtWorldPoint,
  onBrushStrokeEnd,
  onIslandClickMesh,
  orbitEnabled,
  setOrbitEnabled,
  cameraRef,
}: {
  rootGroup: THREE.Group;
  displayScale: number;
  displayOffset: THREE.Vector3;
  activeTool: ScanEditTool;
  cropBoundsRoot: THREE.Box3 | null;
  brushRadiusWorld: number;
  onBrushStrokeAtWorldPoint: (worldPt: THREE.Vector3) => void;
  onBrushStrokeEnd: () => void;
  onIslandClickMesh: (mesh: THREE.Mesh, faceIndex: number) => void;
  orbitEnabled: boolean;
  setOrbitEnabled: (v: boolean) => void;
  cameraRef: React.MutableRefObject<THREE.Camera | null>;
}) {
  const { camera } = useThree();
  const [hoverPoint, setHoverPoint] = useState<THREE.Vector3 | null>(null);
  const isPaintingRef = useRef(false);

  useEffect(() => {
    cameraRef.current = camera;
  }, [camera, cameraRef]);

  useEffect(() => {
    const handleUp = () => {
      if (isPaintingRef.current) {
        isPaintingRef.current = false;
        setOrbitEnabled(true);
        onBrushStrokeEnd();
      }
    };
    window.addEventListener('pointerup', handleUp);
    return () => window.removeEventListener('pointerup', handleUp);
  }, [onBrushStrokeEnd, setOrbitEnabled]);

  // Compute crop box center & size in display world coordinates
  const cropBoxDisplay = useMemo(() => {
    if (!cropBoundsRoot) return null;
    const centerRoot = cropBoundsRoot.getCenter(new THREE.Vector3());
    const sizeRoot = cropBoundsRoot.getSize(new THREE.Vector3());
    return {
      position: new THREE.Vector3(
        (centerRoot.x + displayOffset.x) * displayScale,
        (centerRoot.y + displayOffset.y) * displayScale,
        (centerRoot.z + displayOffset.z) * displayScale
      ),
      size: new THREE.Vector3(
        Math.max(0.01, sizeRoot.x * displayScale),
        Math.max(0.01, sizeRoot.y * displayScale),
        Math.max(0.01, sizeRoot.z * displayScale)
      ),
    };
  }, [cropBoundsRoot, displayOffset, displayScale]);

  return (
    <>
      <Environment preset="city" />
      <ambientLight intensity={1.3} />
      <spotLight position={[5, 10, 5]} intensity={2.5} color="#ffffff" angle={0.5} penumbra={1} castShadow />
      <directionalLight position={[-10, 5, -5]} intensity={1.4} color="#e0f2fe" />

      <group
        scale={[displayScale, displayScale, displayScale]}
        position={[
          displayOffset.x * displayScale,
          displayOffset.y * displayScale,
          displayOffset.z * displayScale,
        ]}
      >
        <primitive
          object={rootGroup}
          onPointerMove={(e: any) => {
            if (activeTool === 'brush') {
              e.stopPropagation();
              setHoverPoint(e.point.clone());
              if (isPaintingRef.current) {
                onBrushStrokeAtWorldPoint(e.point.clone());
              }
            } else if (hoverPoint) {
              setHoverPoint(null);
            }
          }}
          onPointerOut={() => {
            if (!isPaintingRef.current) {
              setHoverPoint(null);
            }
          }}
          onPointerDown={(e: any) => {
            if (e.button !== 0) return; // Only left-click triggers brush/island
            if (activeTool === 'brush' && e.point) {
              e.stopPropagation();
              isPaintingRef.current = true;
              setOrbitEnabled(false);
              setHoverPoint(e.point.clone());
              onBrushStrokeAtWorldPoint(e.point.clone());
            } else if (activeTool === 'island' && e.object && e.faceIndex !== undefined) {
              e.stopPropagation();
              onIslandClickMesh(e.object as THREE.Mesh, e.faceIndex);
            }
          }}
        />
      </group>

      {/* Live Crop Box Wireframe */}
      {activeTool === 'crop' && cropBoxDisplay && (
        <group position={cropBoxDisplay.position}>
          <mesh>
            <boxGeometry args={[cropBoxDisplay.size.x, cropBoxDisplay.size.y, cropBoxDisplay.size.z]} />
            <meshBasicMaterial color="#3b82f6" wireframe transparent opacity={0.45} />
          </mesh>
        </group>
      )}

      {/* 3D Brush Sphere Cursor */}
      {activeTool === 'brush' && hoverPoint && (
        <mesh position={hoverPoint} raycast={() => null}>
          <sphereGeometry args={[brushRadiusWorld, 24, 24]} />
          <meshBasicMaterial color="#ef4444" transparent opacity={0.32} depthTest={false} />
        </mesh>
      )}

      <ContactShadows
        position={[0, -2.3, 0]}
        resolution={512}
        scale={16}
        blur={3.5}
        opacity={0.45}
        far={10}
        color="#0f172a"
      />

      <OrbitControls
        makeDefault
        enabled={orbitEnabled && activeTool !== 'boxCut'}
        enablePan={true}
        minDistance={1.5}
        maxDistance={14}
      />
    </>
  );
}

export interface ScanMeshEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceUrl: string;
  formatHint?: string;
  title?: string;
  saveButtonLabel?: string;
  onSaveEditedFile: (glbFile: File) => Promise<void>;
}

export function ScanMeshEditorModal({
  isOpen,
  onClose,
  sourceUrl,
  formatHint,
  title = 'Edit & Crop 3D Scan',
  saveButtonLabel = 'Save & Attach Cleaned Scan',
  onSaveEditedFile,
}: ScanMeshEditorModalProps) {
  const [activeTool, setActiveTool] = useState<ScanEditTool>('crop');
  const [isLoading, setIsLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [rootGroup, setRootGroup] = useState<THREE.Group | null>(null);
  const [rootBox, setRootBox] = useState<THREE.Box3 | null>(null);
  const [displayScale, setDisplayScale] = useState(1);
  const [displayOffset, setDisplayOffset] = useState<THREE.Vector3>(new THREE.Vector3());

  const recordsRef = useRef<EditableMeshRecord[]>([]);
  const undoStackRef = useRef<Uint8Array[][]>([]);
  const [undoCount, setUndoCount] = useState(0);
  const strokeSnapSavedRef = useRef(false);

  const [totalTriCount, setTotalTriCount] = useState(0);
  const [visibleTriCount, setVisibleTriCount] = useState(0);

  const [crop, setCrop] = useState<CropPercents>(DEFAULT_CROP);
  const [brushSizePct, setBrushSizePct] = useState(5); // % of model diagonal
  const [orbitEnabled, setOrbitEnabled] = useState(true);

  // 2D Screen Box Cutout State
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<THREE.Camera | null>(null);
  const [boxDrag, setBoxDrag] = useState<{
    startX: number;
    startY: number;
    curX: number;
    curY: number;
  } | null>(null);

  const computeCropBoxRoot = useCallback(
    (c: CropPercents, box: THREE.Box3 | null): THREE.Box3 | null => {
      if (!box || !isCropModified(c)) return null;
      const sx = box.max.x - box.min.x;
      const sy = box.max.y - box.min.y;
      const sz = box.max.z - box.min.z;
      return new THREE.Box3(
        new THREE.Vector3(
          box.min.x + (sx * c.xMin) / 100,
          box.min.y + (sy * c.yMin) / 100,
          box.min.z + (sz * c.zMin) / 100
        ),
        new THREE.Vector3(
          box.min.x + (sx * c.xMax) / 100,
          box.min.y + (sy * c.yMax) / 100,
          box.min.z + (sz * c.zMax) / 100
        )
      );
    },
    []
  );

  const cropBoundsRoot = useMemo(
    () => computeCropBoxRoot(crop, rootBox),
    [crop, rootBox, computeCropBoxRoot]
  );

  const refreshAllMeshes = useCallback((liveCropBox: THREE.Box3 | null) => {
    let vis = 0;
    for (const rec of recordsRef.current) {
      vis += rebuildMeshIndexBuffer(rec, liveCropBox);
    }
    setVisibleTriCount(vis);
  }, []);

  const pushUndoSnapshot = useCallback(() => {
    const snap = recordsRef.current.map((r) => r.aliveMask.slice());
    undoStackRef.current.push(snap);
    if (undoStackRef.current.length > 25) {
      undoStackRef.current.shift();
    }
    setUndoCount(undoStackRef.current.length);
  }, []);

  // Load 3D Model on open
  useEffect(() => {
    if (!isOpen || !sourceUrl) return;

    let active = true;
    setIsLoading(true);
    setLoadProgress(null);
    setLoadError(null);
    setCrop(DEFAULT_CROP);
    setActiveTool('crop');
    undoStackRef.current = [];
    setUndoCount(0);

    const onLoaded = (loaded: THREE.Group) => {
      if (!active) return;

      loaded.position.set(0, 0, 0);
      loaded.rotation.set(0, 0, 0);
      loaded.scale.set(1, 1, 1);
      loaded.updateMatrixWorld(true);

      const invRoot = loaded.matrixWorld.clone().invert();
      const records: EditableMeshRecord[] = [];
      const overallBox = new THREE.Box3();
      let grandTotalTris = 0;

      loaded.traverse((child: any) => {
        if (!child.isMesh || !child.geometry) return;
        const mesh = child as THREE.Mesh;
        mesh.geometry = mesh.geometry.clone();
        const geom = mesh.geometry as THREE.BufferGeometry;
        const posAttr = geom.getAttribute('position') as THREE.BufferAttribute;
        if (!posAttr || posAttr.count < 3) return;

        // Enhance PBR materials & make double-sided so cropped openings render cleanly
        // (Mutate in place rather than cloning textures before async blob image.onload completes)
        if (mesh.material) {
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          mats.forEach((mat: any) => {
            mat.side = THREE.DoubleSide;
            if (mat.envMapIntensity !== undefined) mat.envMapIntensity = 2.0;
            if (mat.roughness !== undefined) mat.roughness = Math.max(0.65, mat.roughness);
            mat.needsUpdate = true;
          });
        }

        const existingIndex = geom.getIndex();
        let originalIndices: Uint32Array;
        if (existingIndex) {
          originalIndices = Uint32Array.from(existingIndex.array as ArrayLike<number>);
        } else {
          originalIndices = new Uint32Array(posAttr.count);
          for (let i = 0; i < posAttr.count; i++) originalIndices[i] = i;
        }

        const triCount = Math.floor(originalIndices.length / 3);
        if (triCount === 0) return;

        const originalGroups: OriginalGroupRange[] = geom.groups.map((g) => ({
          triStart: Math.floor(g.start / 3),
          triEnd: Math.floor((g.start + g.count) / 3),
          materialIndex: g.materialIndex,
        }));

        const meshToRoot = new THREE.Matrix4().multiplyMatrices(invRoot, mesh.matrixWorld);
        const centroidsRoot = new Float32Array(triCount * 3);
        const vertsRoot = new Float32Array(triCount * 9);

        const v0 = new THREE.Vector3();
        const v1 = new THREE.Vector3();
        const v2 = new THREE.Vector3();

        for (let t = 0; t < triCount; t++) {
          const i0 = originalIndices[t * 3];
          const i1 = originalIndices[t * 3 + 1];
          const i2 = originalIndices[t * 3 + 2];

          v0.fromBufferAttribute(posAttr, i0).applyMatrix4(meshToRoot);
          v1.fromBufferAttribute(posAttr, i1).applyMatrix4(meshToRoot);
          v2.fromBufferAttribute(posAttr, i2).applyMatrix4(meshToRoot);

          overallBox.expandByPoint(v0);
          overallBox.expandByPoint(v1);
          overallBox.expandByPoint(v2);

          const vb = t * 9;
          vertsRoot[vb] = v0.x;
          vertsRoot[vb + 1] = v0.y;
          vertsRoot[vb + 2] = v0.z;
          vertsRoot[vb + 3] = v1.x;
          vertsRoot[vb + 4] = v1.y;
          vertsRoot[vb + 5] = v1.z;
          vertsRoot[vb + 6] = v2.x;
          vertsRoot[vb + 7] = v2.y;
          vertsRoot[vb + 8] = v2.z;

          const cb = t * 3;
          centroidsRoot[cb] = (v0.x + v1.x + v2.x) / 3;
          centroidsRoot[cb + 1] = (v0.y + v1.y + v2.y) / 3;
          centroidsRoot[cb + 2] = (v0.z + v1.z + v2.z) / 3;
        }

        const aliveMask = new Uint8Array(triCount).fill(1);
        geom.setIndex(new THREE.BufferAttribute(originalIndices.slice(), 1));

        records.push({
          mesh,
          originalIndices,
          originalGroups,
          triCount,
          centroidsRoot,
          vertsRoot,
          aliveMask,
        });
        grandTotalTris += triCount;
      });

      if (records.length === 0 || grandTotalTris === 0) {
        setLoadError('No editable 3D geometry found in this scan.');
        setIsLoading(false);
        return;
      }

      const diag = overallBox.getSize(new THREE.Vector3()).length() || 1;
      const center = overallBox.getCenter(new THREE.Vector3());

      recordsRef.current = records;
      setRootBox(overallBox);
      setDisplayScale(4.5 / diag);
      setDisplayOffset(center.clone().negate());
      setRootGroup(loaded);
      setTotalTriCount(grandTotalTris);
      setVisibleTriCount(grandTotalTris);
      setIsLoading(false);
    };

    const onProgress = (evt: ProgressEvent) => {
      if (active && evt.lengthComputable && evt.total > 0) {
        setLoadProgress(Math.round((evt.loaded / evt.total) * 100));
      }
    };

    const onError = (err: any) => {
      console.error('ScanMeshEditor load error:', err);
      if (active) {
        setLoadError('Failed to load 3D scan for editing.');
        setIsLoading(false);
      }
    };

    const cleanPath = decodeURIComponent((formatHint || sourceUrl).split('?')[0]).toLowerCase();
    if (cleanPath.endsWith('.glb') || cleanPath.endsWith('.gltf')) {
      new GLTFLoader().load(sourceUrl, (gltf) => onLoaded(gltf.scene), onProgress, onError);
    } else if (cleanPath.endsWith('.obj')) {
      new OBJLoader().load(sourceUrl, (obj) => onLoaded(obj), onProgress, onError);
    } else {
      new USDZLoader().load(sourceUrl, (grp: any) => onLoaded(grp), onProgress, onError);
    }

    return () => {
      active = false;
    };
  }, [isOpen, sourceUrl, formatHint]);

  // Live preview of crop sliders
  useEffect(() => {
    if (!rootGroup) return;
    refreshAllMeshes(cropBoundsRoot);
  }, [cropBoundsRoot, rootGroup, refreshAllMeshes]);

  // Commit any active crop sliders permanently into aliveMask
  const commitActiveCropIfNeeded = useCallback((): boolean => {
    const liveCrop = computeCropBoxRoot(crop, rootBox);
    if (!liveCrop) return false;

    let changed = false;
    for (const rec of recordsRef.current) {
      const { triCount, centroidsRoot, aliveMask } = rec;
      for (let t = 0; t < triCount; t++) {
        if (aliveMask[t] === 0) continue;
        const i3 = t * 3;
        if (
          centroidsRoot[i3] < liveCrop.min.x ||
          centroidsRoot[i3] > liveCrop.max.x ||
          centroidsRoot[i3 + 1] < liveCrop.min.y ||
          centroidsRoot[i3 + 1] > liveCrop.max.y ||
          centroidsRoot[i3 + 2] < liveCrop.min.z ||
          centroidsRoot[i3 + 2] > liveCrop.max.z
        ) {
          changed = true;
          break;
        }
      }
      if (changed) break;
    }

    if (!changed) {
      setCrop(DEFAULT_CROP);
      return false;
    }

    pushUndoSnapshot();
    for (const rec of recordsRef.current) {
      const { triCount, centroidsRoot, aliveMask } = rec;
      for (let t = 0; t < triCount; t++) {
        if (aliveMask[t] === 0) continue;
        const i3 = t * 3;
        const cx = centroidsRoot[i3];
        const cy = centroidsRoot[i3 + 1];
        const cz = centroidsRoot[i3 + 2];
        if (
          cx < liveCrop.min.x ||
          cx > liveCrop.max.x ||
          cy < liveCrop.min.y ||
          cy > liveCrop.max.y ||
          cz < liveCrop.min.z ||
          cz > liveCrop.max.z
        ) {
          aliveMask[t] = 0;
        }
      }
    }
    setCrop(DEFAULT_CROP);
    refreshAllMeshes(null);
    return true;
  }, [crop, rootBox, computeCropBoxRoot, pushUndoSnapshot, refreshAllMeshes]);

  const handleSwitchTool = (nextTool: ScanEditTool) => {
    if (activeTool === 'crop' && nextTool !== 'crop' && isCropModified(crop)) {
      commitActiveCropIfNeeded();
    }
    setActiveTool(nextTool);
  };

  const handleUndo = useCallback(() => {
    if (isCropModified(crop)) {
      setCrop(DEFAULT_CROP);
      refreshAllMeshes(null);
      return;
    }
    const lastSnap = undoStackRef.current.pop();
    if (!lastSnap) return;
    recordsRef.current.forEach((rec, idx) => {
      if (lastSnap[idx]) rec.aliveMask.set(lastSnap[idx]);
    });
    setUndoCount(undoStackRef.current.length);
    refreshAllMeshes(null);
  }, [crop, refreshAllMeshes]);

  // Keyboard Ctrl+Z / Cmd+Z Undo
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, handleUndo]);

  const handleResetAll = () => {
    pushUndoSnapshot();
    for (const rec of recordsRef.current) {
      rec.aliveMask.fill(1);
    }
    setCrop(DEFAULT_CROP);
    refreshAllMeshes(null);
  };

  // Brush radius in display world units (display bounding diagonal is normalized to 4.5)
  const brushRadiusWorld = (4.5 * brushSizePct) / 100;

  const handleBrushStrokeAtWorldPoint = useCallback(
    (worldPt: THREE.Vector3) => {
      if (!displayScale) return;
      // Convert display world point back to root-group coordinates
      const rx = worldPt.x / displayScale - displayOffset.x;
      const ry = worldPt.y / displayScale - displayOffset.y;
      const rz = worldPt.z / displayScale - displayOffset.z;
      const radiusRoot = brushRadiusWorld / displayScale;
      const radiusSq = radiusRoot * radiusRoot;

      let anyHit = false;
      for (const rec of recordsRef.current) {
        const { triCount, centroidsRoot, aliveMask } = rec;
        for (let t = 0; t < triCount; t++) {
          if (aliveMask[t] === 0) continue;
          const i3 = t * 3;
          const dx = centroidsRoot[i3] - rx;
          const dy = centroidsRoot[i3 + 1] - ry;
          const dz = centroidsRoot[i3 + 2] - rz;
          if (dx * dx + dy * dy + dz * dz <= radiusSq) {
            if (!strokeSnapSavedRef.current) {
              pushUndoSnapshot();
              strokeSnapSavedRef.current = true;
            }
            aliveMask[t] = 0;
            anyHit = true;
          }
        }
      }

      if (anyHit) {
        refreshAllMeshes(null);
      }
    },
    [displayScale, displayOffset, brushRadiusWorld, pushUndoSnapshot, refreshAllMeshes]
  );

  const handleBrushStrokeEnd = useCallback(() => {
    strokeSnapSavedRef.current = false;
  }, []);

  // Click-to-delete connected island
  const handleIslandClickMesh = useCallback(
    (clickedMesh: THREE.Mesh, faceIndex: number) => {
      if (!rootBox) return;
      const rIdx = recordsRef.current.findIndex((r) => r.mesh === clickedMesh);
      if (rIdx < 0) return;

      const rec = recordsRef.current[rIdx];
      // Map current BufferGeometry faceIndex back to original triangle index
      const curIndexAttr = (clickedMesh.geometry as THREE.BufferGeometry).getIndex();
      if (!curIndexAttr) return;
      const a = curIndexAttr.getX(faceIndex * 3);
      const b = curIndexAttr.getX(faceIndex * 3 + 1);
      const c = curIndexAttr.getX(faceIndex * 3 + 2);

      let matchedOrigTri = -1;
      for (let t = 0; t < rec.triCount; t++) {
        if (rec.aliveMask[t] === 0) continue;
        const s = t * 3;
        if (
          rec.originalIndices[s] === a &&
          rec.originalIndices[s + 1] === b &&
          rec.originalIndices[s + 2] === c
        ) {
          matchedOrigTri = t;
          break;
        }
      }
      if (matchedOrigTri < 0) return;

      const { globalIslandIds, islandSizes } = computeConnectedComponents(
        recordsRef.current,
        rootBox
      );
      const targetIsland = globalIslandIds[rIdx][matchedOrigTri];
      if (targetIsland < 0) return;

      const targetSize = islandSizes.get(targetIsland) || 0;
      if (targetSize >= visibleTriCount) {
        alert(
          'That piece is still connected to the whole garment! Tip: Use the Eraser Brush or Box Cutout to slice across the joint (e.g. shoulder/waist) first, then click the separated part to remove it.'
        );
        return;
      }

      pushUndoSnapshot();
      recordsRef.current.forEach((r, idx) => {
        const ids = globalIslandIds[idx];
        for (let t = 0; t < r.triCount; t++) {
          if (ids[t] === targetIsland) {
            r.aliveMask[t] = 0;
          }
        }
      });
      refreshAllMeshes(null);
    },
    [rootBox, visibleTriCount, pushUndoSnapshot, refreshAllMeshes]
  );

  // Auto-keep ONLY the largest connected piece (deletes all floating scraps/severed limbs)
  const handleKeepLargestPieceOnly = () => {
    if (!rootBox) return;
    commitActiveCropIfNeeded();

    const { globalIslandIds, islandSizes } = computeConnectedComponents(
      recordsRef.current,
      rootBox
    );
    if (islandSizes.size <= 1) {
      alert('No disconnected floating pieces were found. Tip: Use Crop or Eraser Brush to sever unwanted parts first!');
      return;
    }

    let largestIsland = -1;
    let largestCount = -1;
    islandSizes.forEach((count, islandId) => {
      if (count > largestCount) {
        largestCount = count;
        largestIsland = islandId;
      }
    });

    pushUndoSnapshot();
    recordsRef.current.forEach((r, idx) => {
      const ids = globalIslandIds[idx];
      for (let t = 0; t < r.triCount; t++) {
        if (r.aliveMask[t] === 1 && ids[t] !== largestIsland) {
          r.aliveMask[t] = 0;
        }
      }
    });
    refreshAllMeshes(null);
  };

  // Execute 2D Screen Box Cutout
  const applyScreenBoxCutout = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    rectWidth: number,
    rectHeight: number
  ) => {
    const cam = cameraRef.current;
    if (!cam || rectWidth <= 0 || rectHeight <= 0) return;

    const minPx = Math.min(x1, x2);
    const maxPx = Math.max(x1, x2);
    const minPy = Math.min(y1, y2);
    const maxPy = Math.max(y1, y2);
    if (maxPx - minPx < 4 || maxPy - minPy < 4) return;

    cam.updateMatrixWorld();
    const projVec = new THREE.Vector3();
    let changed = false;

    for (const rec of recordsRef.current) {
      const { triCount, centroidsRoot, aliveMask } = rec;
      for (let t = 0; t < triCount; t++) {
        if (aliveMask[t] === 0) continue;
        const i3 = t * 3;
        projVec.set(
          (centroidsRoot[i3] + displayOffset.x) * displayScale,
          (centroidsRoot[i3 + 1] + displayOffset.y) * displayScale,
          (centroidsRoot[i3 + 2] + displayOffset.z) * displayScale
        );
        projVec.project(cam);
        if (projVec.z < -1 || projVec.z > 1) continue;

        const sx = ((projVec.x + 1) * 0.5) * rectWidth;
        const sy = ((-projVec.y + 1) * 0.5) * rectHeight;
        if (sx >= minPx && sx <= maxPx && sy >= minPy && sy <= maxPy) {
          if (!changed) {
            pushUndoSnapshot();
            changed = true;
          }
          aliveMask[t] = 0;
        }
      }
    }

    if (changed) {
      refreshAllMeshes(null);
    }
  };

  // Export cleaned mesh to binary .GLB and pass back to parent
  const handleSave = async () => {
    if (!rootGroup) return;
    commitActiveCropIfNeeded();

    let remaining = 0;
    for (const r of recordsRef.current) {
      for (let t = 0; t < r.triCount; t++) {
        if (r.aliveMask[t] === 1) remaining++;
      }
    }
    if (remaining === 0) {
      alert('Everything has been erased! Undo or Reset before saving.');
      return;
    }

    setIsSaving(true);
    try {
      // Clone scene hierarchy with compacted BufferGeometries (preserving exact original metric scale)
      const exportClone = rootGroup.clone(true);
      const srcMeshes: THREE.Mesh[] = [];
      const dstMeshes: THREE.Mesh[] = [];
      rootGroup.traverse((c: any) => {
        if (c.isMesh) srcMeshes.push(c);
      });
      exportClone.traverse((c: any) => {
        if (c.isMesh) dstMeshes.push(c);
      });

      for (let i = 0; i < dstMeshes.length; i++) {
        const src = srcMeshes[i];
        const dst = dstMeshes[i];
        if (!src || !dst) continue;
        if (!src.visible) {
          dst.parent?.remove(dst);
          continue;
        }
        dst.geometry = compactGeometry(src.geometry as THREE.BufferGeometry);
      }

      const exporter = new GLTFExporter();
      const glbBuffer = (await exporter.parseAsync(exportClone, {
        binary: true,
        onlyVisible: true,
      })) as ArrayBuffer;

      const file = new File([glbBuffer], `edited_scan_${Date.now()}.glb`, {
        type: 'model/gltf-binary',
      });
      await onSaveEditedFile(file);
      onClose();
    } catch (err: any) {
      console.error('Failed to export edited 3D model:', err);
      alert('Failed to save edited 3D scan: ' + (err?.message || String(err)));
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const pctKept =
    totalTriCount > 0 ? Math.round((visibleTriCount / totalTriCount) * 100) : 100;

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-6xl h-[92vh] max-h-[860px] bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="px-4 sm:px-6 py-3.5 border-b border-gray-100 bg-gray-50 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-black text-white flex items-center justify-center shrink-0">
              <Crop size={18} />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-gray-900 truncate">{title}</h2>
              <p className="text-xs text-gray-500 hidden sm:block">
                Crop out mannequin legs/stands, erase arms, or remove floating background pieces.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!isLoading && !loadError && (
              <>
                <span className="hidden md:inline-flex text-[11px] font-mono font-semibold text-gray-500 bg-white border border-gray-200 px-2.5 py-1 rounded-lg">
                  {visibleTriCount.toLocaleString()} faces ({pctKept}%)
                </span>
                <button
                  type="button"
                  disabled={undoCount === 0 && !isCropModified(crop)}
                  onClick={handleUndo}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-100 text-xs font-bold text-gray-700 disabled:opacity-40 transition-colors"
                  title="Undo (Ctrl+Z)"
                >
                  <Undo2 size={14} />
                  Undo{undoCount > 0 ? ` (${undoCount})` : ''}
                </button>
                <button
                  type="button"
                  onClick={handleResetAll}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-100 text-xs font-bold text-gray-700 transition-colors"
                  title="Restore full original scan"
                >
                  <RotateCcw size={14} />
                  <span className="hidden sm:inline">Reset</span>
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-900 rounded-xl hover:bg-gray-200/70 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </header>

        {/* Body: 3D Viewport + Tool Sidebar */}
        <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
          {/* Interactive 3D Canvas Area */}
          <div
            ref={canvasWrapRef}
            className={`flex-1 min-w-0 relative bg-[#f1f3f6] select-none min-h-[320px] ${
              activeTool === 'boxCut'
                ? 'cursor-crosshair'
                : activeTool === 'brush' || activeTool === 'island'
                ? 'cursor-pointer'
                : 'cursor-grab active:cursor-grabbing'
            }`}
            onPointerDown={(e) => {
              if (activeTool !== 'boxCut' || e.button !== 0 || !canvasWrapRef.current) return;
              const rect = canvasWrapRef.current.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const y = e.clientY - rect.top;
              setBoxDrag({ startX: x, startY: y, curX: x, curY: y });
            }}
            onPointerMove={(e) => {
              if (!boxDrag || !canvasWrapRef.current) return;
              const rect = canvasWrapRef.current.getBoundingClientRect();
              setBoxDrag((prev) =>
                prev
                  ? {
                      ...prev,
                      curX: Math.max(0, Math.min(rect.width, e.clientX - rect.left)),
                      curY: Math.max(0, Math.min(rect.height, e.clientY - rect.top)),
                    }
                  : null
              );
            }}
            onPointerUp={() => {
              if (!boxDrag || !canvasWrapRef.current) return;
              const rect = canvasWrapRef.current.getBoundingClientRect();
              applyScreenBoxCutout(
                boxDrag.startX,
                boxDrag.startY,
                boxDrag.curX,
                boxDrag.curY,
                rect.width,
                rect.height
              );
              setBoxDrag(null);
            }}
          >
            {isLoading && (
              <div className="absolute inset-0 z-20 bg-white/80 backdrop-blur-xs flex flex-col items-center justify-center gap-2.5">
                <Loader2 size={28} className="animate-spin text-blue-600" />
                <span className="text-sm font-bold text-gray-800">
                  Loading 3D Mesh for Editing{loadProgress !== null ? ` (${loadProgress}%)` : '...'}
                </span>
              </div>
            )}

            {loadError && (
              <div className="absolute inset-0 z-20 bg-gray-50 flex flex-col items-center justify-center gap-2 p-6 text-center">
                <AlertCircle size={28} className="text-red-500" />
                <span className="text-sm font-bold text-gray-900">{loadError}</span>
              </div>
            )}

            {!isLoading && !loadError && rootGroup && (
              <Canvas
                shadows
                camera={{ position: [0, 0.8, 7.2], fov: 40 }}
                gl={{
                  antialias: true,
                  toneMapping: THREE.ACESFilmicToneMapping,
                  toneMappingExposure: 1.15,
                }}
              >
                <color attach="background" args={['#f1f3f6']} />
                <Suspense fallback={null}>
                  <EditorViewportScene
                    rootGroup={rootGroup}
                    displayScale={displayScale}
                    displayOffset={displayOffset}
                    activeTool={activeTool}
                    cropBoundsRoot={cropBoundsRoot}
                    brushRadiusWorld={brushRadiusWorld}
                    onBrushStrokeAtWorldPoint={handleBrushStrokeAtWorldPoint}
                    onBrushStrokeEnd={handleBrushStrokeEnd}
                    onIslandClickMesh={handleIslandClickMesh}
                    orbitEnabled={orbitEnabled}
                    setOrbitEnabled={setOrbitEnabled}
                    cameraRef={cameraRef}
                  />
                </Suspense>
              </Canvas>
            )}

            {/* 2D Screen Box Selection Overlay */}
            {boxDrag && (
              <div
                className="absolute z-30 border-2 border-dashed border-red-500 bg-red-500/15 pointer-events-none rounded-xs"
                style={{
                  left: Math.min(boxDrag.startX, boxDrag.curX),
                  top: Math.min(boxDrag.startY, boxDrag.curY),
                  width: Math.abs(boxDrag.curX - boxDrag.startX),
                  height: Math.abs(boxDrag.curY - boxDrag.startY),
                }}
              />
            )}

            {/* Bottom Floating Context Hint */}
            {!isLoading && !loadError && (
              <div className="absolute bottom-3 inset-x-0 flex justify-center z-10 pointer-events-none px-4">
                <div className="bg-white/90 backdrop-blur px-4 py-1.5 rounded-full text-[11px] font-bold text-gray-700 border border-gray-200 shadow-xs text-center">
                  {activeTool === 'crop' && 'Use sliders on the right to trim · Drag model to inspect from any angle'}
                  {activeTool === 'brush' && 'Drag on garment to erase · Drag empty background to rotate · Scroll to zoom'}
                  {activeTool === 'boxCut' && 'Drag a red box across any part to slice it off from this camera angle'}
                  {activeTool === 'island' && 'Click any disconnected part (e.g. severed arm/stand) to remove it in one click'}
                  {activeTool === 'orbit' && 'Drag to rotate · Right-drag to pan · Scroll to zoom'}
                </div>
              </div>
            )}
          </div>

          {/* Right Control Panel */}
          <aside className="w-full lg:w-80 xl:w-[340px] shrink-0 border-t lg:border-t-0 lg:border-l border-gray-200 bg-white p-4 sm:p-5 overflow-y-auto space-y-4">
            {/* Tool Switcher */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                Editing Tool
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleSwitchTool('crop')}
                  className={`flex items-center gap-2 px-2.5 py-2.5 rounded-xl text-xs font-bold border transition-all text-left min-w-0 ${
                    activeTool === 'crop'
                      ? 'bg-black text-white border-black shadow-sm'
                      : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <Crop size={14} className="shrink-0" />
                  <span className="truncate">3D Crop Box</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSwitchTool('brush')}
                  className={`flex items-center gap-2 px-2.5 py-2.5 rounded-xl text-xs font-bold border transition-all text-left min-w-0 ${
                    activeTool === 'brush'
                      ? 'bg-black text-white border-black shadow-sm'
                      : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <Eraser size={14} className="shrink-0" />
                  <span className="truncate">Eraser Brush</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSwitchTool('boxCut')}
                  className={`flex items-center gap-2 px-2.5 py-2.5 rounded-xl text-xs font-bold border transition-all text-left min-w-0 ${
                    activeTool === 'boxCut'
                      ? 'bg-black text-white border-black shadow-sm'
                      : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <SquareDashedMousePointer size={14} className="shrink-0" />
                  <span className="truncate">Box Cutout</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSwitchTool('island')}
                  className={`flex items-center gap-2 px-2.5 py-2.5 rounded-xl text-xs font-bold border transition-all text-left min-w-0 ${
                    activeTool === 'island'
                      ? 'bg-black text-white border-black shadow-sm'
                      : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <Wand2 size={14} className="shrink-0" />
                  <span className="truncate">Delete Part</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSwitchTool('orbit')}
                  className={`col-span-2 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                    activeTool === 'orbit'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <Move3d size={14} className="shrink-0" />
                  <span>Rotate / Inspect Camera</span>
                </button>
              </div>
            </div>

            {/* Active Tool Controls */}
            {activeTool === 'crop' && (
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-900">Trim Boundaries</span>
                  {isCropModified(crop) && (
                    <button
                      type="button"
                      onClick={() => setCrop(DEFAULT_CROP)}
                      className="text-[11px] font-semibold text-gray-500 hover:text-gray-900"
                    >
                      Reset Box
                    </button>
                  )}
                </div>

                {/* Vertical (Bottom / Top) — Most Used for Mannequin Legs & Neck */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px] font-bold text-gray-700">
                    <span>Bottom Trim (Legs / Stand)</span>
                    <span className="font-mono text-blue-600">{crop.yMin}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={Math.max(0, crop.yMax - 5)}
                    value={crop.yMin}
                    onChange={(e) => setCrop((p) => ({ ...p, yMin: Number(e.target.value) }))}
                    className="w-full accent-blue-600 cursor-pointer"
                  />

                  <div className="flex justify-between text-[11px] font-bold text-gray-700 pt-1">
                    <span>Top Trim (Neck / Hanger)</span>
                    <span className="font-mono text-blue-600">{100 - crop.yMax}%</span>
                  </div>
                  <input
                    type="range"
                    min={Math.min(100, crop.yMin + 5)}
                    max={100}
                    value={crop.yMax}
                    onChange={(e) => setCrop((p) => ({ ...p, yMax: Number(e.target.value) }))}
                    className="w-full accent-blue-600 cursor-pointer"
                  />
                </div>

                <hr className="border-gray-200" />

                {/* Horizontal (Left / Right) */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px] font-bold text-gray-700">
                    <span>Left Side Trim</span>
                    <span className="font-mono text-blue-600">{crop.xMin}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={Math.max(0, crop.xMax - 5)}
                    value={crop.xMin}
                    onChange={(e) => setCrop((p) => ({ ...p, xMin: Number(e.target.value) }))}
                    className="w-full accent-blue-600 cursor-pointer"
                  />

                  <div className="flex justify-between text-[11px] font-bold text-gray-700 pt-1">
                    <span>Right Side Trim</span>
                    <span className="font-mono text-blue-600">{100 - crop.xMax}%</span>
                  </div>
                  <input
                    type="range"
                    min={Math.min(100, crop.xMin + 5)}
                    max={100}
                    value={crop.xMax}
                    onChange={(e) => setCrop((p) => ({ ...p, xMax: Number(e.target.value) }))}
                    className="w-full accent-blue-600 cursor-pointer"
                  />
                </div>

                <hr className="border-gray-200" />

                {/* Depth (Back / Front) */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px] font-bold text-gray-700">
                    <span>Back Depth Trim</span>
                    <span className="font-mono text-blue-600">{crop.zMin}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={Math.max(0, crop.zMax - 5)}
                    value={crop.zMin}
                    onChange={(e) => setCrop((p) => ({ ...p, zMin: Number(e.target.value) }))}
                    className="w-full accent-blue-600 cursor-pointer"
                  />

                  <div className="flex justify-between text-[11px] font-bold text-gray-700 pt-1">
                    <span>Front Depth Trim</span>
                    <span className="font-mono text-blue-600">{100 - crop.zMax}%</span>
                  </div>
                  <input
                    type="range"
                    min={Math.min(100, crop.zMin + 5)}
                    max={100}
                    value={crop.zMax}
                    onChange={(e) => setCrop((p) => ({ ...p, zMax: Number(e.target.value) }))}
                    className="w-full accent-blue-600 cursor-pointer"
                  />
                </div>

                {isCropModified(crop) && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={commitActiveCropIfNeeded}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl"
                  >
                    <Check size={14} className="mr-1.5" />
                    Apply Crop Cut
                  </Button>
                )}
              </div>
            )}

            {activeTool === 'brush' && (
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-gray-900">3D Eraser Size</span>
                  <span className="text-xs font-mono font-bold text-red-600">{brushSizePct}%</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={18}
                  step={0.5}
                  value={brushSizePct}
                  onChange={(e) => setBrushSizePct(Number(e.target.value))}
                  className="w-full accent-red-500 cursor-pointer"
                />
                <p className="text-[11px] text-gray-500 leading-relaxed">
                  Paint directly over mannequin arms, torso, or stray mesh areas to erase them. Drag empty space to rotate the garment to another angle.
                </p>
              </div>
            )}

            {activeTool === 'boxCut' && (
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-2.5">
                <span className="text-xs font-bold text-gray-900 block">Rectangle Cutout</span>
                <p className="text-[11px] text-gray-500 leading-relaxed">
                  Drag a rectangle across the viewport to slice away everything inside that box from your current camera angle. Switch to <strong>Rotate / Inspect</strong> anytime to line up your next cut.
                </p>
              </div>
            )}

            {activeTool === 'island' && (
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-2.5">
                <span className="text-xs font-bold text-gray-900 block">Click Part to Remove</span>
                <p className="text-[11px] text-gray-500 leading-relaxed">
                  Click any disconnected piece (like a severed mannequin arm or stand) to delete that entire piece at once.
                </p>
              </div>
            )}

            {/* One-Click Auto Cleanup */}
            <div className="pt-1 border-t border-gray-100 space-y-2">
              <button
                type="button"
                disabled={isLoading || Boolean(loadError)}
                onClick={handleKeepLargestPieceOnly}
                className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border border-purple-200 bg-purple-50/70 hover:bg-purple-100/80 text-purple-800 text-xs font-bold transition-colors disabled:opacity-50"
              >
                <Sparkles size={14} />
                Auto-Remove Floating Debris
              </button>
              <p className="text-[10px] text-gray-400 text-center leading-snug">
                Keeps the main garment and deletes all detached arms, legs, or background scraps.
              </p>
            </div>
          </aside>
        </div>

        {/* Footer */}
        <footer className="px-4 sm:px-6 py-3.5 border-t border-gray-100 bg-gray-50 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:text-gray-900 hover:bg-gray-200/60 transition-colors"
          >
            Cancel
          </button>

          <Button
            type="button"
            onClick={handleSave}
            isLoading={isSaving}
            disabled={isLoading || Boolean(loadError) || isSaving}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-sm whitespace-nowrap"
          >
            {!isSaving && <Check size={15} className="mr-1.5 shrink-0" />}
            <span>{isSaving ? 'Saving Cleaned 3D Model...' : saveButtonLabel}</span>
          </Button>
        </footer>
      </div>
    </div>,
    document.body
  );
}
