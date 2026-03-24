import React, { useEffect, useRef, useState } from 'react';
import { Crosshair, Plus, Ruler, X } from 'lucide-react';

interface Point {
  x: number;
  y: number;
  z: number;
}

export function WebXRLidar({ onComplete, onCancel }: { onComplete: (measurements: any[]) => void, onCancel: () => void }) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [measurements, setMeasurements] = useState<{ id: number, start: Point, end: Point, distance: number }[]>([]);
  const [arStatus, setArStatus] = useState<string>('Initializing WebXR LiDAR...');
  const [canAddPoint, setCanAddPoint] = useState(false);
  
  // Real-time tracking
  const hitPositionRef = useRef<Point | null>(null);
  const xrSessionRef = useRef<any>(null);

  useEffect(() => {
    let session: any = null;
    let animationFrameId = 0;
    
    const initAR = async () => {
      try {
        const navRaw = navigator as any;
        if (!navRaw.xr) {
          setArStatus('WebXR not supported on this device/browser.');
          return;
        }
        const isSupported = await navRaw.xr.isSessionSupported('immersive-ar');
        if (!isSupported) {
          setArStatus('Immersive AR not supported.');
          return;
        }

        setArStatus('Starting AR Session...');
        session = await navRaw.xr.requestSession('immersive-ar', {
          requiredFeatures: ['hit-test', 'dom-overlay'],
          domOverlay: { root: overlayRef.current }
        });
        xrSessionRef.current = session;

        // Boilerplate WebGL context required to render the camera passthrough
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl', { xrCompatible: true }) as WebGLRenderingContext;
        if (!gl) throw new Error('WebGL not supported');
        
        session.updateRenderState({ baseLayer: new (window as any).XRWebGLLayer(session, gl) });

        const referenceSpace = await session.requestReferenceSpace('local');
        const viewerSpace = await session.requestReferenceSpace('viewer');
        const hitTestSource = await session.requestHitTestSource({ space: viewerSpace });

        setArStatus('');

        const onXRFrame = (time: number, frame: any) => {
          animationFrameId = session.requestAnimationFrame(onXRFrame);
          // Just clear the frame so the camera shows through
          gl.bindFramebuffer(gl.FRAMEBUFFER, session.renderState.baseLayer.framebuffer);
          gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

          const hitTestResults = frame.getHitTestResults(hitTestSource);
          if (hitTestResults.length > 0) {
            const hitPose = hitTestResults[0].getPose(referenceSpace);
            hitPositionRef.current = {
              x: hitPose.transform.position.x,
              y: hitPose.transform.position.y,
              z: hitPose.transform.position.z,
            };
            setCanAddPoint(true);
          } else {
            hitPositionRef.current = null;
            setCanAddPoint(false);
          }
        };

        animationFrameId = session.requestAnimationFrame(onXRFrame);

        session.addEventListener('end', () => {
          onCancel();
        });

      } catch (e: any) {
        console.error(e);
        setArStatus(`Failed to start AR: ${e.message}`);
      }
    };

    initAR();

    return () => {
      if (session) {
        if (animationFrameId) session.cancelAnimationFrame(animationFrameId);
        session.end().catch(console.error);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTap = () => {
    if (!hitPositionRef.current) return;
    const newPoint = { ...hitPositionRef.current };
    
    setPoints(prev => {
      const next = [...prev, newPoint];
      if (next.length === 2) {
        const start = next[0];
        const end = next[1];
        const distMeters = Math.sqrt(
          (end.x - start.x) ** 2 +
          (end.y - start.y) ** 2 +
          (end.z - start.z) ** 2
        );
        const distCm = (distMeters * 100).toFixed(1);
        
        setMeasurements(m => [...m, { id: Date.now(), start, end, distance: parseFloat(distCm) }]);
        return []; // Reset points for next measurement
      }
      return next;
    });
  };

  const handleFinish = async () => {
    try {
      if (xrSessionRef.current) {
        await xrSessionRef.current.end();
      }
    } catch(e) {}
    onComplete(measurements);
  };

  return (
    <div ref={overlayRef} className="fixed inset-0 w-full h-full pointer-events-none select-none z-[9999]" style={{ display: 'flex', flexDirection: 'column' }}>
      {/* HUD Layer */}
      {arStatus ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 bg-black/80">
           <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-6" />
           <p className="text-white font-serif text-xl text-center">{arStatus}</p>
           <button onClick={onCancel} className="mt-8 pointer-events-auto bg-gray-800 text-white px-6 py-2 rounded-full">Cancel</button>
        </div>
      ) : (
        <>
          <div className="p-6 bg-gradient-to-b from-black/80 to-transparent pointer-events-auto flex justify-between items-center">
            <button onClick={onCancel} className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white">
              <X size={20} />
            </button>
            <div className="text-center">
              <h2 className="text-white font-bold tracking-wide">LiDAR Measure</h2>
              <p className="text-white/70 text-xs">Tap to place anchor points</p>
            </div>
            <button 
              onClick={handleFinish} 
              className="px-4 py-2 rounded-full bg-green-500 text-black font-bold text-sm"
            >
              Done
            </button>
          </div>

          <div className="flex-1 relative pointer-events-none">
            {/* Center Reticle */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transition-colors duration-200">
              <Crosshair size={48} className={canAddPoint ? "text-green-400" : "text-white/50"} strokeWidth={1} />
            </div>
            
            {/* Live measurement hints */}
            {points.length === 1 && (
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 translate-y-8 bg-black/60 backdrop-blur-md text-white px-3 py-1 rounded-full text-xs animate-pulse">
                Move device to end point...
              </div>
            )}
          </div>

          <div className="bg-gradient-to-t from-black/90 to-transparent p-6 pointer-events-auto flex flex-col items-center gap-6">
            
            <div className="flex flex-wrap gap-2 justify-center max-w-full">
              {measurements.map(m => (
                <div key={m.id} className="bg-indigo-600/90 text-white px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-lg backdrop-blur-md">
                   <Ruler size={14} />
                   <span className="font-bold font-mono">{m.distance} cm</span>
                </div>
              ))}
            </div>

            <button 
              onClick={handleTap} 
              disabled={!canAddPoint}
              className="w-20 h-20 rounded-full border-4 border-white/40 flex items-center justify-center disabled:opacity-50 disabled:scale-95 active:scale-95 transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)]"
            >
              <div className={`w-16 h-16 rounded-full flex items-center justify-center ${canAddPoint ? 'bg-white text-black' : 'bg-white/20 text-white/50'}`}>
                <Plus size={32} />
              </div>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
