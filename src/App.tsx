import { Canvas } from '@react-three/fiber';
import { useEffect } from 'react';
import { snapMode, urlLogin } from './lib/urlParams';
import { Galaxy } from './scene/Galaxy';
import { useGalaxyStore } from './state/store';
import { SceneErrorBoundary } from './ui/ErrorBoundary';
import { HUD } from './ui/HUD';

export default function App() {
  const selectRepo = useGalaxyStore((s) => s.selectRepo);
  const loadProfile = useGalaxyStore((s) => s.loadProfile);

  // Deep link: ?u=<login> charts that account on load. Embedded images
  // link back here so a click lands on the live galaxy.
  useEffect(() => {
    if (urlLogin) void loadProfile(urlLogin);
  }, [loadProfile]);

  return (
    <div className="app">
      <SceneErrorBoundary>
        {/* flat disables built-in tone mapping; ACES runs once, in Effects.
            preserveDrawingBuffer lets the Save image button read the canvas. */}
        <Canvas
          flat
          dpr={[1, 2]}
          gl={{ preserveDrawingBuffer: true }}
          camera={{ position: [16, 9, 26], fov: 40 }}
          onPointerMissed={() => selectRepo(null)}
        >
          <Galaxy />
        </Canvas>
      </SceneErrorBoundary>
      {!snapMode && <HUD />}
    </div>
  );
}
