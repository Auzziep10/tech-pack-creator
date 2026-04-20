import React, { Suspense, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stage } from '@react-three/drei';
import * as THREE from 'three';
// Bypass three-stdlib and directly import the underlying Three.js loader
import { USDZLoader } from 'three/examples/jsm/loaders/USDZLoader.js';
import { Download, Smartphone } from 'lucide-react';

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
          // Normalize and scale the model slightly
          group.scale.set(10, 10, 10);
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

  if (error) {
    return (
      <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="gray" wireframe />
      </mesh>
    );
  }

  if (!scene) return null;

  return <primitive object={scene} />;
};

export const Garment3DViewer = ({ url }: { url: string }) => {
  if (!url) return null;

  return (
    <div className="w-full h-full flex flex-col gap-2">
      <div className="w-full min-h-[400px] bg-gradient-to-b from-gray-50 to-gray-200 rounded-2xl overflow-hidden relative border border-gray-200 shadow-inner">
        <div className="absolute top-4 left-4 z-10 bg-white/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/40 shadow-sm text-xs font-bold text-gray-700 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
          LIVE 3D VIEWPORT
        </div>
        
        <Canvas shadows camera={{ position: [0, 2, 5], fov: 45 }}>
          <Suspense fallback={null}>
            <Stage environment="city" intensity={0.5} adjustCamera>
              <Model url={url} />
            </Stage>
          </Suspense>
          <OrbitControls makeDefault autoRotate autoRotateSpeed={0.5} minPolarAngle={0} maxPolarAngle={Math.PI / 1.5} />
        </Canvas>
        
        <div className="absolute bottom-4 right-4 z-10 text-gray-400 text-[10px] font-medium tracking-wider uppercase">
          * Drag to orbit • Scroll to zoom
        </div>
      </div>

      <div className="flex items-center gap-2 mt-2">
        <a 
          href={url} 
          rel="ar"
          className="flex-1 flex items-center justify-center gap-2 bg-black text-white hover:bg-gray-800 py-3 px-4 rounded-xl font-bold transition-colors text-sm"
        >
          <Smartphone size={16} />
          Launch Native iOS AR
        </a>
        
        <a 
          href={url} 
          download
          className="flex-1 flex items-center justify-center gap-2 bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 py-3 px-4 rounded-xl font-bold transition-colors text-sm"
        >
          <Download size={16} />
          Download .USDZ
        </a>
      </div>
    </div>
  );
};
