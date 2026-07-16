import type { ScrollWorldConfig } from './scrub-engine'

/**
 * Reality — scroll-world cinematic intro configuration.
 *
 * Assets are NOT committed yet: the stills and camera clips are generated with
 * Higgsfield by David (see scrollworld/README.md for the exact commands and
 * prompt files). Until every referenced file exists under public/scrollworld/,
 * keep `SCROLL_WORLD_ENABLED` false — the intro stays completely out of the
 * render tree and the game boots straight to Welcome as today.
 */
export const SCROLL_WORLD_ENABLED = false

const A = '/scrollworld'

export const scrollWorldConfig: ScrollWorldConfig = {
  brand: { name: 'Reality' },
  diveScroll: 1.3,
  connScroll: 0.9,
  hint: 'scroll to fly in',
  nav: true,
  atmosphere: true,
  sections: [
    {
      id: 'orbit',
      label: 'The Planet',
      still: `${A}/orbit.webp`,
      clip: `${A}/vid/orbit.mp4`,
      accent: '#7dd8ff',
      eyebrow: 'A second life on a living Earth',
      title: 'One planet. Millions of stories.',
      body: 'Reality is a life simulation played on a real 3D Earth — every citizen, job and coin exists in one shared world.',
      tags: ['Persistent world', 'Real geography'],
      scroll: 1.6,
      linger: 0.4,
    },
    {
      id: 'city',
      label: 'The City',
      still: `${A}/city.webp`,
      clip: `${A}/vid/city.mp4`,
      accent: '#f0b429',
      eyebrow: 'Land anywhere',
      title: 'Your city, block by block.',
      body: 'Walk the streets, meet citizens, and claim your place in a miniature city that never stops moving.',
      tags: ['Street mode', 'Live citizens'],
    },
    {
      id: 'work',
      label: 'The Work',
      still: `${A}/work.webp`,
      clip: `${A}/vid/work.mp4`,
      accent: '#43d9a3',
      eyebrow: 'Earn your keep',
      title: 'Every shift counts.',
      body: 'Take jobs, level up through the ledger, and turn hours into experience and coin — one honest simulation path, no shortcuts.',
      tags: ['Jobs & XP', 'Fair economy'],
    },
    {
      id: 'market',
      label: 'The Market',
      still: `${A}/market.webp`,
      clip: `${A}/vid/market.mp4`,
      accent: '#e8a33d',
      eyebrow: 'Trade the world',
      title: 'A market with real stakes.',
      body: 'Buy assets, trade goods and grow a portfolio in an economy balanced for the long game.',
      tags: ['Assets', 'Player economy'],
    },
    {
      id: 'build',
      label: 'The Build',
      still: `${A}/build.webp`,
      clip: `${A}/vid/build.mp4`,
      accent: '#7c8aa5',
      eyebrow: 'Leave a mark',
      title: 'Raise something permanent.',
      body: 'Construction sites rise in phases on the map — from foundations to the completion reveal, your buildings live in the world.',
      tags: ['Construction', 'HoMM-style sites'],
    },
    {
      id: 'begin',
      label: 'Begin',
      still: `${A}/begin.webp`,
      clip: `${A}/vid/begin.mp4`,
      accent: '#f0b429',
      eyebrow: 'Your citizen is waiting',
      title: 'Begin your Reality.',
      body: 'Create your citizen and step onto the planet.',
      scroll: 1.7,
      linger: 0.5,
      cta: { label: 'Enter the world' },
    },
  ],
  connectors: [
    `${A}/vid/conn1.mp4`,
    `${A}/vid/conn2.mp4`,
    `${A}/vid/conn3.mp4`,
    `${A}/vid/conn4.mp4`,
    `${A}/vid/conn5.mp4`,
  ],
}
