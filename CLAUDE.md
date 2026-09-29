@AGENTS.md

# City RL Tracker: notes for Claude

- Owner: Ali (team captain). Explain the approach before each phase; keep TODO.md and docs/ current.
- Read docs/HANDOFF.md for decisions and the design spec; docs/points-engine.md and docs/data-model.md for the logic.
- Engines in `src/lib/engine` are pure and tested. Change them test-first (`npm test`).
- Never invent stats: missing replay data shows dashed "—" placeholders.
- Copy rule: never "win the 1–0 match" / "the 2–0 match". Use "Winners' match", "Round 3", "Win all three", …
- Always show a W/L letter with the win/loss colour.
- Checks before pushing: `npm run typecheck && npm run lint && npm test && npx next build`.
- Seed data: edit `seed-data/` or `scripts/seed-config.ts`, then `npm run seed:build`.
