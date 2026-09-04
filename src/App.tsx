import { useEffect } from 'react';
import { MotionArena } from './components/MotionArena';
import { registerWebMcpTools } from './webmcp/registerTools';

export default function App() {
  useEffect(() => {
    let dispose: () => void = () => undefined;
    void registerWebMcpTools().then((cleanup) => { dispose = cleanup; });
    return () => dispose();
  }, []);

  return <MotionArena />;
}
