import React, { Suspense, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Center, Environment, ContactShadows, Float, Line } from '@react-three/drei';
import * as THREE from 'three';
import { USDZLoader } from 'three/examples/jsm/loaders/USDZLoader.js';
import { Download, Smartphone, Box, Ruler, Check, X, Undo2 } from 'lucide-react';

const Model = ({ url, isMeasuring, onAddPoint, onLoadedScale }: { url: string, isMeasuring: boolean, onAddPoint: (p: THREE.Vector3) => void, onLoadedScale: (s: number) => void }) => {
  const [scene, setScene] = useState<THREE.Group | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const loader = new USDZLoader();
    loader.load(
      url,
      (group: any) => {
        if (active) {
          // Normalize scale aggressively using bounding box
          const box = new THREE.Box3().setFromObject(group);
          const size = box.getSize(new THREE.Vector3()).length();
          const targetScale = 6 / size; 
          group.scale.setScalar(targetScale);
          onLoadedScale(targetScale);

          // Force mesh to cast and receive shadows for premium lighting
          group.traverse((child: any) => {
             if (child.isMesh) {
                 child.castShadow = true;
                 child.receiveShadow = true;
             }
          });

          setScene(group);
        }
      },
      undefined,
      (err: any) => {
        console.error("USDZLoader Error:", err);
        if (active) setError("Failed to load 3D mesh.");
      }
    );

    return () => { active = false; };
  }, [url]);

  if (error || !scene) return null;

  return (
    <primitive 
      object={scene} 
      onClick={(e: any) => {
        if (isMeasuring && e.point) {
          e.stopPropagation();
          onAddPoint(e.point.clone());
        }
      }}
    />
  );
};

// Fallback HTML box if things are still loading
function Loader() {
  return (
    <mesh>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color="#e5e7eb" wireframe />
    </mesh>
  );
}

// Dynamic Lighting Presets
type LightPreset = 'studio' | 'dramatic' | 'outdoor' | 'soft';
const LIGHT_CONFIG = {
  studio: { label: 'Studio', env: 'city', bg: '#fafafa', ambient: 1.2, rim: [5, 10, 5], rimInt: 2.5, rimCol: '#ffffff', fill: [-10, 5, -5], fillInt: 1.5, fillCol: '#e0f2fe', shadow: '#0f172a' },
  dramatic: { label: 'Dramatic', env: 'night', bg: '#1e293b', ambient: 0.2, rim: [8, 5, -8], rimInt: 4.5, rimCol: '#ffedd5', fill: [-8, -2, 5], fillInt: 1.5, fillCol: '#38bdf8', shadow: '#000000' },
  outdoor: { label: 'Outdoor', env: 'sunset', bg: '#fef3c7', ambient: 1.5, rim: [-10, 10, 10], rimInt: 3.5, rimCol: '#fef08a', fill: [5, 2, -5], fillInt: 1.0, fillCol: '#fed7aa', shadow: '#78350f' },
  soft: { label: 'Soft', env: 'warehouse', bg: '#f3f4f6', ambient: 2.5, rim: [0, 5, 0], rimInt: 1.0, rimCol: '#ffffff', fill: [0, -5, 0], fillInt: 0.5, fillCol: '#ffffff', shadow: '#94a3b8' }
};

export const Garment3DViewer = ({ 
  url, 
  measurements = [], 
  onUpdateMeasurement 
}: { 
  url: string, 
  measurements?: any[], 
  onUpdateMeasurement?: (idx: number, val: string) => void 
}) => {
  const [preset, setPreset] = useState<LightPreset>('studio');
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [tapePoints, setTapePoints] = useState<THREE.Vector3[]>([]);
  const [meshScale, setMeshScale] = useState(1);
  const [selectedTargetPOM, setSelectedTargetPOM] = useState<string>('');
  
  const config = LIGHT_CONFIG[preset];

  if (!url) return null;

  // Calculate distance
  // 1 meter = 39.3701 inches
  let totalWorldDistance = 0;
  for (let i = 0; i < tapePoints.length - 1; i++) {
    totalWorldDistance += tapePoints[i].distanceTo(tapePoints[i+1]);
  }
  const trueMeters = totalWorldDistance / meshScale;
  const trueInches = (trueMeters * 39.3701).toFixed(2);

  return (
    <div className="w-full h-full flex flex-col gap-3">
      {/* 3D Canvas Container */}
      <div className="w-full h-[500px] bg-[#f8f9fa] rounded-3xl overflow-hidden relative border-2 border-gray-100 shadow-[inset_0_4px_24px_rgba(0,0,0,0.02)] print:hidden cursor-move group">
        
        {/* Top left overlay badge (Hidden when measuring to save space) */}
        {!isMeasuring && (
          <div className="absolute top-5 left-5 z-10 bg-white/90 backdrop-blur-md px-4 py-2 rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/20 flex items-center gap-3 transition-opacity">
            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-500">
              <Box size={16} />
            </div>
            <div>
               <div className="flex items-center gap-2">
                   <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse outline outline-2 outline-blue-100"></span>
                   <span className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">Live Mesh Engine</span>
               </div>
               <p className="font-bold text-gray-900 text-sm leading-tight mt-0.5">LiDAR Capture</p>
            </div>
          </div>
        )}

        {/* Measuring Console Panel */}
        {isMeasuring && (
          <div className="absolute top-5 left-5 z-20 bg-white/95 backdrop-blur-md p-4 rounded-2xl border-2 border-red-200 shadow-xl w-72">
            <div className="flex items-center justify-between mb-2 border-b border-red-100 pb-2">
               <h3 className="font-extrabold text-red-500 flex items-center gap-2"><Ruler size={16}/> Virtual Tape Measure</h3>
               <button onClick={() => { setIsMeasuring(false); setTapePoints([]); }} className="text-gray-400 hover:text-black">
                 <X size={18} />
               </button>
            </div>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-tight mb-4">
              To measure round surfaces, <span className="text-red-500 font-extrabold pb-0.5 border-b-2 border-red-200">drop multiple pins</span> along the curve to trace it (like a physical measuring tape). Clicking only two points calculates a straight line through the cavity!
            </p>
            
            <div className="bg-red-50 text-red-600 rounded-xl p-3 mb-4 flex items-center justify-between shadow-inner border border-red-100">
               <span className="font-bold text-xs uppercase opacity-80">Distance:</span>
               <span className="text-xl font-mono tracking-tighter font-extrabold">{trueInches}"</span>
            </div>

            <div className="flex flex-col gap-2">
              <select 
                value={selectedTargetPOM} 
                onChange={(e) => setSelectedTargetPOM(e.target.value)}
                className="bg-gray-50 border border-gray-200 text-gray-800 text-xs rounded-lg block w-full p-2 outline-none focus:border-red-400 font-semibold"
              >
                <option value="">-- View Target POM (Optional) --</option>
                {measurements.map((m, idx) => (
                   <option key={idx} value={String(idx)}>
                     {m.id} - {m.point}
                   </option>
                ))}
              </select>
              
              <div className="flex gap-2 mt-1">
                <button 
                  onClick={() => {
                    const newPoints = [...tapePoints];
                    newPoints.pop();
                    setTapePoints(newPoints);
                  }}
                  disabled={tapePoints.length === 0}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 p-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors disabled:opacity-50"
                >
                  <Undo2 size={14}/> Undo
                </button>
                <button 
                  onClick={() => {
                    if (onUpdateMeasurement && selectedTargetPOM !== '') {
                      onUpdateMeasurement(parseInt(selectedTargetPOM), trueInches);
                      setIsMeasuring(false);
                      setTapePoints([]);
                    }
                  }}
                  disabled={selectedTargetPOM === '' || tapePoints.length < 2}
                  className="flex-[2] bg-red-600 hover:bg-red-700 text-white p-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors disabled:opacity-50"
                >
                  <Check size={14}/> Overwrite Spec
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Lighting Controls - Top Right */}
        <div className="absolute top-5 right-5 z-10 flex flex-col gap-2 items-end">
          {!isMeasuring && (
            <button
               onClick={() => setIsMeasuring(true)}
               className="mb-4 bg-red-500 hover:bg-red-600 hover:-translate-y-0.5 text-white shadow-md shadow-red-500/20 px-4 py-2 font-bold text-xs uppercase tracking-widest rounded-xl border border-red-600 flex items-center justify-center gap-2 transition-all"
            >
               <Ruler size={14} /> Virtual Tape Measure
            </button>
          )}

          {Object.entries(LIGHT_CONFIG).map(([key, val]) => (
            <button
              key={key}
              onClick={() => setPreset(key as LightPreset)}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-bold tracking-widest uppercase transition-all shadow-sm backdrop-blur-md border ${
                 preset === key 
                 ? 'bg-black text-white border-black scale-105' 
                 : 'bg-white/80 text-gray-500 border-gray-200 hover:bg-white hover:text-gray-900'
              }`}
            >
              {val.label}
            </button>
          ))}
        </div>
        
        <Canvas shadows camera={{ position: [0, 2, 8], fov: 40 }}>
          <color attach="background" args={[config.bg]} />
          
          <Suspense fallback={<Loader />}>
            {/* @ts-ignore */}
            <Environment preset={config.env} />
            
            <ambientLight intensity={config.ambient} />
            <spotLight position={config.rim as any} intensity={config.rimInt} color={config.rimCol} angle={0.5} penumbra={1} castShadow shadow-mapSize={[2048, 2048]} />
            <directionalLight position={config.fill as any} intensity={config.fillInt} color={config.fillCol} />
            
            {/* Freeze floating and rotation if measuring so tape paths don't de-sync from world space object */}
            <Float 
               speed={isMeasuring ? 0 : 1.5} 
               rotationIntensity={isMeasuring ? 0 : 0.2} 
               floatIntensity={isMeasuring ? 0 : 0.5}
            >
              <Center>
                <Model 
                   url={url} 
                   isMeasuring={isMeasuring} 
                   onAddPoint={(p) => setTapePoints([...tapePoints, p])} 
                   onLoadedScale={setMeshScale}
                />
              </Center>
            </Float>
            
            {tapePoints.length > 0 && tapePoints.map((p, i) => (
               <mesh key={i} position={p}>
                 <sphereGeometry args={[0.04, 16, 16]} />
                 <meshBasicMaterial color="#ef4444" />
               </mesh>
            ))}
            
            {tapePoints.length > 1 && (
               <Line 
                 points={tapePoints} 
                 color="#ef4444" 
                 lineWidth={4} 
                 dashed={true} 
                 dashScale={20} 
                 dashSize={0.5} 
                 gapSize={0.5}
               />
            )}

            <ContactShadows resolution={1024} scale={20} blur={2.5} opacity={0.4} far={10} color={config.shadow} />
          </Suspense>

          <OrbitControls 
            makeDefault 
            autoRotate={!isMeasuring} 
            autoRotateSpeed={1.5} 
            enablePan={true} 
            target={[0, 1, 0]}
            minPolarAngle={Math.PI / 4} 
            maxPolarAngle={Math.PI / 1.7} 
            minDistance={4}
            maxDistance={12}
          />
        </Canvas>
        
        {/* Bottom instructions */}
        <div className="absolute bottom-4 left-0 w-full flex justify-center z-10 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500">
          <div className="bg-white/80 backdrop-blur px-4 py-1.5 rounded-full text-[10px] font-bold tracking-wider uppercase text-gray-500 border border-white shadow-sm">
            {isMeasuring ? 'Rotate: Click + Drag • Drop Point: Tap Mesh Surface' : 'Drag to Orbit • Scroll to Zoom'}
          </div>
        </div>
      </div>

      {/* Control Strip */}
      <div className="grid grid-cols-2 gap-3 w-full">
        <a 
          href={url} 
          rel="ar"
          className="flex items-center justify-center gap-2 bg-gray-900 text-white hover:bg-black hover:shadow-lg hover:-translate-y-0.5 py-4 px-4 rounded-2xl font-bold transition-all text-sm w-full border-t border-gray-700 isolate"
        >
          <Smartphone size={18} className="opacity-80" />
          Native AR Hologram
        </a>
        
        <a 
          href={url} 
          download
          className="flex items-center justify-center gap-2 bg-white text-gray-700 hover:text-gray-900 border-2 border-gray-100 hover:border-gray-200 hover:bg-gray-50 py-4 px-4 rounded-2xl font-bold transition-all text-sm w-full shadow-sm"
        >
          <Download size={18} className="text-gray-400" />
          Export Source .USDZ
        </a>
      </div>
    </div>
  );
};
