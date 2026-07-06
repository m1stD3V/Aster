import { Canvas } from '@react-three/fiber';
import { useEffect, useState } from 'react';
import { snapMode, urlLogin } from './lib/urlParams';
import { Galaxy } from './scene/Galaxy';
import { useGalaxyStore } from './state/store';
import { SceneErrorBoundary } from './ui/ErrorBoundary';
import { HUD } from './ui/HUD';
import { Intro } from './ui/Intro';

export default function App() {
  const selectRepo = useGalaxyStore((s) => s.selectRepo);
  const loadProfile = useGalaxyStore((s) => s.loadProfile);
  // The landing overlay shows once per visit; deep links and snapshot
  // captures go straight to the scene.
  const [showIntro, setShowIntro] = useState(() => !urlLogin && !snapMode);

  // Deep link: ?u=<login> charts that account on load. Embedded images
  // link back here so a click lands on the live galaxy.
  useEffect(() => {
    if (urlLogin) void loadProfile(urlLogin);
  }, [loadProfile]);

  return (
    <div className="app">
      <SceneErrorBoundary>
        {/* flat disables built-in tone mapping; ACES runs once, in Effects.
            preserveDrawingBuffer lets the Save image button read the canvas.
            The camera starts pulled back; CameraRig glides it home for a
            small cinematic arrival on every load. */}
        <Canvas
          flat
          dpr={[1, 2]}
          gl={{ preserveDrawingBuffer: true }}
          camera={{ position: [42, 22, 58], fov: 40 }}
          onPointerMissed={() => selectRepo(null)}
        >
          <Galaxy />
        </Canvas>
      </SceneErrorBoundary>
      {!snapMode && !showIntro && <HUD />}
      {showIntro && <Intro onDismiss={() => setShowIntro(false)} />}
    </div>
  );
}
