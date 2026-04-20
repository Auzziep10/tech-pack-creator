import React, { Suspense, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Center, Environment, ContactShadows, Float } from '@react-three/drei';
import * as THREE from 'three';
import { USDZLoader } from 'three/examples/jsm/loaders/USDZLoader.js';
import { Download, Smartphone, Box } from 'lucide-react';

const Model = ({ url }: { url: string }) => {
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

  if (error) return null;
  if (!scene) return null;

  return <primitive object={scene} />;
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

export const Garment3DViewer = ({ url }: { url: string }) => {
  const [preset, setPreset] = useState<LightPreset>('studio');
  const config = LIGHT_CONFIG[preset];

  if (!url) return null;

  return (
    <div className="w-full h-full flex flex-col gap-3">
      {/* 3D Canvas Container */}
      <div className="w-full h-[500px] bg-[#f8f9fa] rounded-3xl overflow-hidden relative border-2 border-gray-100 shadow-[inset_0_4px_24px_rgba(0,0,0,0.02)] print:hidden cursor-move group">
        
        {/* Top left overlay badge */}
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

        {/* Lighting Controls - Top Right */}
        <div className="absolute top-5 right-5 z-10 flex flex-col gap-2">
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
            
            <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.5}>
              <Center>
                <Model url={url} />
              </Center>
            </Float>
            
            <ContactShadows resolution={1024} scale={20} blur={2.5} opacity={0.4} far={10} color={config.shadow} />
          </Suspense>

          <OrbitControls 
            makeDefault 
            autoRotate 
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
            Drag to Orbit &bull; Scroll to Zoom
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
