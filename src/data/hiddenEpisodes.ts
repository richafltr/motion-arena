import type { HiddenEpisode } from '../types';

const motion = (subject: number, trial: number, label: string) => {
  const stem = `${String(subject).padStart(2, '0')}_${String(trial).padStart(2, '0')}`;
  return {
    id: `cmu-${stem.replace('_', '-')}`,
    label,
    url: `/motions/cmu-diverse/${stem}.bvh`,
    variant: 1,
    source: 'bvh' as const,
  };
};

/** Diverse, human-curated CMU actions. Asset identity stays out of WebMCP responses. */
export const hiddenEpisodes: HiddenEpisode[] = [
  {
    id: 'heldout-swordplay', subject: 2, trial: 7,
    caption: 'A person advances and performs a sequence of sweeping sword-fighting strikes.',
    sourceDescription: 'swordplay',
    groundTruth: motion(2, 7, 'Sword-fighting sequence'),
  },
  {
    id: 'heldout-basketball-shot', subject: 6, trial: 15,
    caption: 'A person dribbles a basketball forward, gathers it, and takes a shot.',
    sourceDescription: 'basketball - dribble, shoot',
    groundTruth: motion(6, 15, 'Basketball dribble and shot'),
  },
  {
    id: 'heldout-dance', subject: 5, trial: 7,
    caption: 'A dancer performs small leaps, holds an arabesque, spins off-axis, and turns.',
    sourceDescription: 'dance - small jetes, attitude/arabesque, shifted-axis pirouette, turn',
    groundTruth: motion(5, 7, 'Leaps, arabesque, and pirouette'),
  },
  {
    id: 'heldout-punch', subject: 2, trial: 5,
    caption: 'A person plants their feet and throws a forceful forward punch.',
    sourceDescription: 'punch/strike',
    groundTruth: motion(2, 5, 'Punch and strike'),
  },
  {
    id: 'heldout-jump-balance', subject: 2, trial: 4,
    caption: 'A person jumps, lands, and steadies their body to regain balance.',
    sourceDescription: 'jump, balance',
    groundTruth: motion(2, 4, 'Jump and balance'),
  },
  {
    id: 'heldout-scoop', subject: 2, trial: 6,
    caption: 'A person bends down, scoops something up, rises, and lifts one arm.',
    sourceDescription: 'bend over, scoop up, rise, lift arm',
    groundTruth: motion(2, 6, 'Bend, scoop, and lift'),
  },
  {
    id: 'heldout-forward-dribble', subject: 6, trial: 2,
    caption: 'A person walks forward while rhythmically dribbling a basketball with one hand.',
    sourceDescription: 'basketball - forward dribble',
    groundTruth: motion(6, 2, 'Forward basketball dribble'),
  },
  {
    id: 'heldout-soccer-kick', subject: 10, trial: 2,
    caption: 'A person approaches a ball, plants one foot, and kicks forward with the other leg.',
    sourceDescription: 'soccer - kick ball',
    groundTruth: motion(10, 2, 'Soccer kick'),
  },
  {
    id: 'heldout-run', subject: 2, trial: 3,
    caption: 'A person accelerates into a steady forward run.',
    sourceDescription: 'run/jog',
    groundTruth: motion(2, 3, 'Forward run'),
  },
  {
    id: 'heldout-zombie-march', subject: 20, trial: 8,
    caption: 'A person shuffles forward with a stiff, exaggerated zombie-like march.',
    sourceDescription: 'zombie march',
    groundTruth: motion(20, 8, 'Zombie march'),
  },
];
