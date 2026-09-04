import { useEffect, useRef, useState } from 'react';
import {
  ACESFilmicToneMapping,
  AmbientLight,
  Color,
  DirectionalLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
  type Camera,
  type Material,
  type Object3D,
  type Texture,
} from 'three';
import { AVATAR_URL, CANDIDATE_MOTION_URL } from '../data/demoMotions';
import { fitClipDuration, loadBvhClip } from '../motion/bvh';
import { connectSynchronizedCamera } from '../motion/cameraSync';
import { loadAvatar } from '../motion/loadAvatar';
import { SynchronizedMotionPlayer } from '../motion/player';
import { createCandidateClip } from '../motion/retarget';
import { loadVrmaClip } from '../motion/vrma';
import { experimentStore, useExperimentStore } from '../state/experimentStore';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { MotionAsset } from '../types';

type MotionPaneProps = {
  side: 'candidate' | 'truth';
  label: string;
  sublabel: string;
};

type ArenaRenderer = {
  domElement: HTMLCanvasElement;
  setSize: (width: number, height: number, updateStyle?: boolean) => void;
  setPixelRatio: (ratio: number) => void;
  renderFrame: (scene: Scene, camera: Camera) => void;
  dispose: () => void;
  kind: 'webgpu' | 'webgl2';
};

async function createRenderer(canvas: HTMLCanvasElement): Promise<ArenaRenderer> {
  const forceWebGl = new URLSearchParams(window.location.search).has('forceWebgl');
  if (!forceWebGl && 'gpu' in navigator) {
    try {
      const { WebGPURenderer } = await import('three/webgpu');
      const renderer = new WebGPURenderer({ canvas, antialias: true, alpha: true });
      await renderer.init();
      renderer.outputColorSpace = SRGBColorSpace;
      renderer.toneMapping = ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      return {
        domElement: renderer.domElement,
        setSize: (width, height) => renderer.setSize(width, height, false),
        setPixelRatio: (ratio) => renderer.setPixelRatio(ratio),
        renderFrame: (scene, camera) => { void renderer.render(scene, camera); },
        dispose: () => renderer.dispose(),
        kind: 'webgpu',
      };
    } catch (error) {
      console.info('WebGPU renderer unavailable; falling back to WebGL2.', error);
    }
  }

  const context = canvas.getContext('webgl2', { alpha: true, antialias: true, powerPreference: 'high-performance' });
  if (!context) throw new Error('This browser does not provide WebGPU or WebGL2.');
  const renderer = new WebGLRenderer({ canvas, context, antialias: true, alpha: true });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  return {
    domElement: renderer.domElement,
    setSize: (width, height) => renderer.setSize(width, height, false),
    setPixelRatio: (ratio) => renderer.setPixelRatio(ratio),
    renderFrame: (scene, camera) => renderer.render(scene, camera),
    dispose: () => renderer.dispose(),
    kind: 'webgl2',
  };
}

function disposeScene(root: Object3D) {
  root.traverse((object) => {
    const mesh = object as Mesh;
    mesh.geometry?.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    for (const material of materials as Material[]) {
      for (const value of Object.values(material)) {
        if (value && typeof value === 'object' && 'isTexture' in value) (value as Texture).dispose();
      }
      material.dispose();
    }
  });
}

export function MotionPane({ side, label, sublabel }: MotionPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const selected = useExperimentStore((state) => state.selectedRolloutId);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    let cancelled = false;
    let frame = 0;
    let resizeObserver: ResizeObserver | undefined;
    let cleanup: () => void = () => undefined;

    void (async () => {
      try {
        const renderer = await createRenderer(canvas);
        if (cancelled) { renderer.dispose(); return; }
        experimentStore.getState().setRenderer(renderer.kind);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));

        const scene = new Scene();
        scene.background = new Color(0x111516);
        const camera = new PerspectiveCamera(28, 1, 0.1, 30);
        const controls = new OrbitControls(camera, canvas);
        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.enablePan = false;
        controls.minDistance = 2.6;
        controls.maxDistance = 7;
        controls.minPolarAngle = 0.18;
        controls.maxPolarAngle = Math.PI - 0.18;
        const disconnectCamera = connectSynchronizedCamera(camera, controls);

        const ambient = new AmbientLight(0xe8f2ec, 1.55);
        const key = new DirectionalLight(0xffffff, 3.4);
        key.position.set(-2.5, 4, 3);
        const rim = new DirectionalLight(0x9af7c7, 1.7);
        rim.position.set(3, 2.2, -2);
        scene.add(ambient, key, rim);

        const floor = new Mesh(
          new PlaneGeometry(9, 9),
          new MeshStandardMaterial({ color: 0x171c1d, roughness: 0.82, metalness: 0.05 }),
        );
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = 0;
        scene.add(floor);

        const vrm = await loadAvatar(AVATAR_URL, renderer.kind);
        if (cancelled) { disposeScene(vrm.scene); renderer.dispose(); return; }
        scene.add(vrm.scene);
        const player = new SynchronizedMotionPlayer(vrm.scene);
        const initialState = experimentStore.getState();
        let motionLoadToken = 0;
        const candidateBaseClip = side === 'candidate'
          ? fitClipDuration(await loadVrmaClip(CANDIDATE_MOTION_URL, vrm), initialState.duration)
          : null;

        const loadMotion = async (asset: MotionAsset) => {
          const token = ++motionLoadToken;
          setLoadState('loading');
          setError('');
          try {
            const state = experimentStore.getState();
            let clip;
            if (side === 'truth' || asset.source === 'bvh') {
              clip = await loadBvhClip(asset.url, vrm, {
                duration: state.duration,
                ...(side === 'candidate' ? {
                  variant: asset.variant,
                  hiddenSpan: state.hiddenSpan,
                  residualPolicy: asset.residualPolicy,
                } : {}),
              });
            } else if (asset.source === 'bvh-residual') {
              clip = await loadBvhClip(asset.url, vrm, {
                duration: state.duration,
                variant: asset.variant,
                hiddenSpan: state.hiddenSpan,
                residualPolicy: asset.residualPolicy,
              });
            } else if (asset.source === 'vrma') {
              clip = fitClipDuration(await loadVrmaClip(asset.url, vrm), state.duration);
            } else {
              if (!candidateBaseClip) throw new Error('Candidate base animation is unavailable.');
              clip = createCandidateClip(candidateBaseClip, asset.variant);
            }
            if (!cancelled && token === motionLoadToken) {
              player.setClip(clip);
              setLoadState('ready');
            }
          } catch (cause) {
            if (cancelled || token !== motionLoadToken) return;
            const message = cause instanceof Error ? cause.message : 'Motion asset failed to load.';
            console.error(`${side} motion failed to load`, cause);
            setError(message);
            setLoadState('error');
          }
        };

        if (side === 'truth') {
          await loadMotion(initialState.groundTruth);
        } else {
          const rollout = initialState.rollouts.find((item) => item.id === initialState.selectedRolloutId);
          if (rollout) await loadMotion(rollout.motion);
        }

        if (side === 'candidate') {
          const unsubscribe = experimentStore.subscribe((state, previous) => {
            if (state.selectedRolloutId !== previous.selectedRolloutId) {
              const rollout = state.rollouts.find((item) => item.id === state.selectedRolloutId);
              if (rollout) void loadMotion(rollout.motion);
            }
          });
          cleanup = unsubscribe;
        } else {
          const unsubscribe = experimentStore.subscribe((state, previous) => {
            if (state.groundTruth.id !== previous.groundTruth.id) void loadMotion(state.groundTruth);
          });
          cleanup = unsubscribe;
        }

        resizeObserver = new ResizeObserver(() => {
          const { width, height } = container.getBoundingClientRect();
          renderer.setSize(Math.max(1, width), Math.max(1, height));
          camera.aspect = width / Math.max(1, height);
          camera.updateProjectionMatrix();
        });
        resizeObserver.observe(container);

        const render = () => {
          if (cancelled) return;
          const { playback, duration } = experimentStore.getState();
          player.seek(playback.time % duration);
          controls.update();
          vrm.update(0);
          renderer.renderFrame(scene, camera);
          frame = requestAnimationFrame(render);
        };
        setLoadState('ready');
        render();

        const oldCleanup = cleanup;
        cleanup = () => {
          oldCleanup();
          disconnectCamera();
          controls.dispose();
          cancelAnimationFrame(frame);
          resizeObserver?.disconnect();
          player.dispose();
          disposeScene(scene);
          renderer.dispose();
        };
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : 'Unable to load the motion renderer.';
        console.error(cause);
        experimentStore.getState().setRenderer('unavailable');
        setError(message);
        setLoadState('error');
      }
    })();

    return () => { cancelled = true; cleanup(); };
  }, [side]);

  return (
    <section className={`motion-pane motion-pane--${side}`} aria-label={label}>
      <div className="pane-heading">
        <span className={`pane-dot pane-dot--${side}`} />
        <div>
          <h2>{label}</h2>
          <p>{sublabel}{side === 'candidate' ? ` · ${selected.toUpperCase()}` : ''}</p>
        </div>
      </div>
      <div className="viewport" ref={containerRef}>
        <canvas ref={canvasRef} />
        {loadState === 'loading' && <div className="viewport-state"><span className="spinner" />Loading VRM + motion…</div>}
        {loadState === 'error' && <div className="viewport-state viewport-state--error">{error}</div>}
        {loadState === 'ready' && <div className="orbit-hint">Drag to orbit · scroll to zoom</div>}
        <div className="viewport-corners" aria-hidden="true" />
      </div>
    </section>
  );
}
