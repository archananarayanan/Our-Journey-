# 💕 Our Journey – Nick & Judy's Love Meter

A (almost) static TypeScript + Tailwind CSS dashboard where **Nick Wilde 🦊** and **Judy Hopps 🐰** earn love points together.

## Features

- **Love Score Dashboard** – enter any number of points and click **Add Love** or **Lose Love**
- **Progress Bar** – fills from 0 → 10,000 with a milestone marker every 1,000 pts
- **Milestone Celebrations** – on every 1,000-point milestone, a random celebration video plays with confetti
- **Action Log** – tracks recent point changes
- **Celebration Zone** – embedded video panel with a randomly chosen `.mp4` clip

## Quick Start

```bash
npm install
npm run dev
```

Open <http://localhost:5173>.

## Adding Real Celebration Videos

Drop your `.mov` (or `.mp4`) files into `public/videos/` named `celebration1.mp4` … `celebration5.mp4`.
Add more entries to the `CELEBRATION_VIDEOS` array in `src/main.ts` to include them in the random pool.

## Configuration

In `src/main.ts`:

```ts
const MAX_POINTS = 10_000;          // change the upper limit
const MILESTONE_INTERVAL = 1_000;   // change the milestone spacing
```

## Build

```bash
npm run build   # outputs to dist/
npm run preview # serve the build locally
```
