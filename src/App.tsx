import { useEffect } from 'react';
import { MotionArena } from './components/MotionArena';
import { registerWebMcpTools } from './webmcp/registerTools';
import { useExperimentStore } from './state/experimentStore';

export default function App() {
  const initializeEnvironment = useExperimentStore((state) => state.initializeEnvironment);

  useEffect(() => { void initializeEnvironment(); }, [initializeEnvironment]);

  useEffect(() => {
    let dispose: () => void = () => undefined;
    void registerWebMcpTools().then((cleanup) => { dispose = cleanup; });
    return () => dispose();
  }, []);

  return <MotionArena />;
}
