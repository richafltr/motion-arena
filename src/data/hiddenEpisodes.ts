import type { HiddenEpisode } from '../types';

const motion = (trial: number, label: string) => ({
  id: `cmu-01-${String(trial).padStart(2, '0')}`,
  label,
  url: `/motions/cmu-playground/01_${String(trial).padStart(2, '0')}.bvh`,
  variant: 1,
  source: 'bvh' as const,
});

/**
 * Human-curated captions derived from CMU's descriptions for Subject 1,
 * playground trials 1–10. Asset identity stays out of WebMCP responses.
 */
export const hiddenEpisodes: HiddenEpisode[] = [
  {
    id: 'heldout-playground-01', subject: 1, trial: 1,
    caption: 'A person makes several forward jumps, then turns around.',
    sourceDescription: 'playground - forward jumps, turn around',
    groundTruth: motion(1, 'Forward jumps and turn'),
  },
  {
    id: 'heldout-playground-02', subject: 1, trial: 2,
    caption: 'A person reaches upward and climbs onto playground equipment.',
    sourceDescription: 'playground - climb',
    groundTruth: motion(2, 'Climb'),
  },
  {
    id: 'heldout-playground-03', subject: 1, trial: 3,
    caption: 'A person climbs up, hangs from both arms, and swings their body.',
    sourceDescription: 'playground - climb, hang, swing',
    groundTruth: motion(3, 'Climb, hang, and swing'),
  },
  {
    id: 'heldout-playground-04', subject: 1, trial: 4,
    caption: 'A person steadily climbs upward using both arms and legs.',
    sourceDescription: 'playground - climb',
    groundTruth: motion(4, 'Steady climb'),
  },
  {
    id: 'heldout-playground-05', subject: 1, trial: 5,
    caption: 'A person climbs, crouches down, and moves underneath an obstacle.',
    sourceDescription: 'playground - climb, go under',
    groundTruth: motion(5, 'Climb and go under'),
  },
  {
    id: 'heldout-playground-06', subject: 1, trial: 6,
    caption: 'A person climbs up, sits, dangles both legs, then descends.',
    sourceDescription: 'playground - climb, sit, dangle legs, descend',
    groundTruth: motion(6, 'Climb, sit, and descend'),
  },
  {
    id: 'heldout-playground-07', subject: 1, trial: 7,
    caption: 'A person climbs up, sits with legs dangling, then jumps down.',
    sourceDescription: 'playground - climb, sit, dangle legs, jump down',
    groundTruth: motion(7, 'Climb, sit, and jump down'),
  },
  {
    id: 'heldout-playground-08', subject: 1, trial: 8,
    caption: 'A person climbs, sits and dangles their legs, rocks backward, then lowers to the ground.',
    sourceDescription: 'playground - climb, sit, dangle legs, rock back, lower self to ground',
    groundTruth: motion(8, 'Climb, rock back, and lower'),
  },
  {
    id: 'heldout-playground-09', subject: 1, trial: 9,
    caption: 'A person climbs and hangs with straight arms, swings, drops to sit, then moves underneath.',
    sourceDescription: 'playground - climb, hang, hold self up with arms straight, swing, drop, sit, dangle legs, go under',
    groundTruth: motion(9, 'Extended playground sequence'),
  },
  {
    id: 'heldout-playground-10', subject: 1, trial: 10,
    caption: 'A person climbs up, swings, leans backward, and drops down.',
    sourceDescription: 'playground - climb, swing, lean back, drop',
    groundTruth: motion(10, 'Climb, swing, and drop'),
  },
];
