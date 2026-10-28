## Signal Wars (the game layer)

A neon-blue pixel game on top of the map. Everything is optional: guests can still scan and browse.

- **Explorer**: nickname + customisable pixel portrait (Man, Woman, Android, Alien, Bear; hair, headgear, eyewear, gear, outfit, mood, background; 12 ready-made characters). No login. A recovery code restores the explorer on another phone.
- **XP, levels, streaks, daily missions, badges** on every scan. Rules live in `server/src/game/rules.js` (pure functions, easy to tune).
- **Fog of war**: rooms nobody has scanned are "unexplored". Rooms not scanned for 7+ days pay a bounty.
- **Rex's Lair**: a weak scan (score under 30) opens a runner game by itself, with an End game button; dead-zone rooms and an offline phone open it too. Every open is counted per room (/api/game/rex-open and rex-close). It is a runner game whose track is built from the room's real packet loss, jitter and delay. Records per room, daily XP cap.
- **Screens**: `/play` (missions, leaderboard, exploration), profile dossier card (tap your name in the top bar), live ticker.

New server files: `server/src/game/*`, `server/src/routes/game.js` (+ `Player`, `Run` in `models.js`).
New client files: `client/src/game/*` (theme in `neon.css`; fonts are bundled, so they work offline).
Existing files were touched only at lines marked `GAME`.

Checks: `npm run verify:game` (no database needed) and `npm run verify:10` (full, needs MongoDB).
Avatar numbers must match in `client/src/game/portrait.js` and `server/src/game/rules.js`.
