import { Canvas } from '@react-three/fiber';
import { Galaxy } from './scene/Galaxy';
import { useGalaxyStore } from './state/store';
import { SceneErrorBoundary } from './ui/ErrorBoundary';
import { HUD } from './ui/HUD';

export default function App() {
  const selectRepo = useGalaxyStore((s) => s.selectRepo);

  return (
    <div className="app">
      <SceneErrorBoundary>
        {/* flat disables built-in tone mapping; ACES runs once, in Effects. */}
        <Canvas
          flat
          dpr={[1, 2]}
          camera={{ position: [16, 9, 26], fov: 40 }}
          onPointerMissed={() => selectRepo(null)}
        >
          <Galaxy />
        </Canvas>
      </SceneErrorBoundary>
      <HUD />
    </div>
  );
}
