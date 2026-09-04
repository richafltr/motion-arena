import { useCallback, useEffect, useRef } from 'react';
import {
  ACESFilmicToneMapping,
  AmbientLight,
  AnimationMixer,
  Color,
  DirectionalLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
  type AnimationAction,
  type AnimationClip,
} from 'three';
import { AVATAR_URL } from '../data/demoMotions';
import { fitClipDuration, loadBvhClip } from '../motion/bvh';
import { disposeScene } from '../motion/dispose';
import { loadAvatar } from '../motion/loadAvatar';
import { loadVrmaClip } from '../motion/vrma';
import { experimentStore } from '../state/experimentStore';
import type { Rollout } from '../types';

const PREVIEW_HEIGHT = 82;
const PREVIEW_INTERVAL = 1000 / 12;

type ClipEntry = { clip: AnimationClip; action: AnimationAction };

async function loadRolloutClip(rollout: Rollout, duration: number, hiddenSpan: [number, number], vrm: Awaited<ReturnType<typeof loadAvatar>>) {
  const { motion } = rollout;
  if (motion.source === 'bvh' || motion.source === 'bvh-residual') {
    return loadBvhClip(motion.url, vrm, {
      duration,
      variant: motion.variant,
      hiddenSpan,
      residualPolicy: motion.residualPolicy,
    });
  }
  return fitClipDuration(await loadVrmaClip(motion.url, vrm), duration);
}

/** A single scissored WebGL canvas renders all visible rollout cards with one shared VRM. */
export function useRolloutMiniVrms() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const galleryRef = useRef<HTMLDivElement>(null);
  const previews = useRef(new Map<string, HTMLDivElement>());

  const registerPreview = useCallback((rolloutId: string, preview: HTMLDivElement | null) => {
    if (preview) previews.current.set(rolloutId, preview);
    else previews.current.delete(rolloutId);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const gallery = galleryRef.current;
    if (!canvas || !gallery) return;
    let disposed = false;
    let frame = 0;
    let lastPreview = 0;
    let unsubscribe: () => void = () => undefined;
    const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.4));
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.setClearColor(0x000000, 0);
    renderer.setScissorTest(true);

    void (async () => {
      try {
        const scene = new Scene();
        scene.background = new Color(0x0b0f0e);
        const camera = new PerspectiveCamera(28, 1.78, 0.1, 30);
        camera.position.set(0, 1.12, 4.65);
        camera.lookAt(0, 1, 0);
        const ambient = new AmbientLight(0xe8f2ec, 1.65);
        const key = new DirectionalLight(0xffffff, 3.2);
        key.position.set(-2.5, 4, 3);
        const rim = new DirectionalLight(0x9af7c7, 1.4);
        rim.position.set(3, 2.2, -2);
        scene.add(ambient, key, rim);
        const floor = new Mesh(
          new PlaneGeometry(8, 8),
          new MeshStandardMaterial({ color: 0x171d1b, roughness: 0.86, metalness: 0.03 }),
        );
        floor.rotation.x = -Math.PI / 2;
        scene.add(floor);

        const vrm = await loadAvatar(AVATAR_URL, 'webgl2');
        if (disposed) { disposeScene(vrm.scene); renderer.dispose(); return; }
        scene.add(vrm.scene);
        const mixer = new AnimationMixer(vrm.scene);
        const entries = new Map<string, ClipEntry>();
        const pending = new Set<string>();
        let activeEpisode = experimentStore.getState().episodeId;

        const clearEntries = () => {
          mixer.stopAllAction();
          for (const { clip } of entries.values()) mixer.uncacheClip(clip);
          entries.clear();
        };

        const ensureClips = () => {
          const state = experimentStore.getState();
          if (state.episodeId !== activeEpisode) {
            activeEpisode = state.episodeId;
            clearEntries();
          }
          for (const rollout of state.rollouts) {
            const keyName = `${state.episodeId}:${rollout.id}`;
            if (entries.has(keyName) || pending.has(keyName)) continue;
            pending.add(keyName);
            void loadRolloutClip(rollout, state.duration, state.hiddenSpan, vrm)
              .then((clip) => {
                if (disposed || experimentStore.getState().episodeId !== state.episodeId) return;
                entries.set(keyName, { clip, action: mixer.clipAction(clip) });
              })
              .catch((error) => console.warn(`Mini VRM preview unavailable for ${rollout.id}.`, error))
              .finally(() => pending.delete(keyName));
          }
        };

        ensureClips();
        unsubscribe = experimentStore.subscribe((state, previous) => {
          if (state.episodeId !== previous.episodeId || state.rollouts !== previous.rollouts) ensureClips();
        });

        let renderWidth = 0;
        const renderPreviews = (now: number) => {
          if (disposed) return;
          frame = requestAnimationFrame(renderPreviews);
          if (document.hidden || now - lastPreview < PREVIEW_INTERVAL) return;
          lastPreview = now;
          const width = Math.max(1, gallery.clientWidth);
          if (width !== renderWidth) {
            renderWidth = width;
            renderer.setSize(width, PREVIEW_HEIGHT, false);
          }
          renderer.setScissorTest(false);
          renderer.clear(true, true, true);
          renderer.setScissorTest(true);
          const canvasRect = canvas.getBoundingClientRect();
          if (canvasRect.bottom <= 0 || canvasRect.top >= window.innerHeight) return;
          const state = experimentStore.getState();
          for (const rollout of state.rollouts) {
            const preview = previews.current.get(rollout.id);
            const entry = entries.get(`${state.episodeId}:${rollout.id}`);
            if (!preview || !entry) continue;
            const rect = preview.getBoundingClientRect();
            const x = rect.left - canvasRect.left;
            if (x + rect.width <= 0 || x >= canvasRect.width) continue;
            mixer.stopAllAction();
            entry.action.reset().play();
            mixer.setTime(state.playback.time % state.duration);
            vrm.update(0);
            camera.aspect = rect.width / PREVIEW_HEIGHT;
            camera.updateProjectionMatrix();
            renderer.setViewport(x, 0, rect.width, PREVIEW_HEIGHT);
            renderer.setScissor(Math.max(0, x), 0, Math.min(rect.width, canvasRect.width - Math.max(0, x)), PREVIEW_HEIGHT);
            renderer.render(scene, camera);
          }
        };
        frame = requestAnimationFrame(renderPreviews);

        const previousUnsubscribe = unsubscribe;
        unsubscribe = () => {
          previousUnsubscribe();
          cancelAnimationFrame(frame);
          clearEntries();
          mixer.uncacheRoot(vrm.scene);
          disposeScene(scene);
          renderer.dispose();
        };
      } catch (error) {
        console.warn('Shared mini VRM renderer unavailable.', error);
        renderer.dispose();
      }
    })();

    return () => {
      disposed = true;
      unsubscribe();
      cancelAnimationFrame(frame);
    };
  }, []);

  return { canvasRef, galleryRef, registerPreview };
}
