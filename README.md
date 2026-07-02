# Tobias Straus Command Center (Web)

## Run
```bash
npm install
npm run dev
```

## Notes
- Tasks include TickTick-style fields plus subtasks.
- Quadrant is derived via `computeQuadrant(task)`.
- Urgency is inferred from `dueAt` (within 24h) unless `urgencyOverride` is enabled.
