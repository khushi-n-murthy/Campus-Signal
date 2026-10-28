# Merge notes: theme + 3D campus + Signal Wars

This tree combines two lines of work on top of the original CampusSignal code:

- **Theme & 3D** — glass/neon-blue UI, the real campus map in 3D (24 buildings, 3 floors × 5 rooms),
  Kenney furniture and trees, and a walk-through of the CSE Dept with a live signal heatmap.
- **Signal Wars** — the game layer (explorers, XP, missions, fog of war, Rex's Lair). See `SIGNAL_WARS_README.md`.

## How it was merged

The game package's edits to existing files (`integration.patch`) were applied as a 3-way merge with the original
code as the common ancestor, so both sides' changes to the same files were kept. All 134 lines the patch adds are
present, plus every new game file. The game's new files were converted from CRLF to LF line endings to match the repo.

Three small conflicts were resolved by keeping both sides:
- `client/package.json` — both font packages (Archivo for the site, Press Start 2P + VT323 for the game).
- `client/src/main.jsx` — both font imports, plus `GameProvider` / `GameLayer`.
- `client/index.html` — the theme colour stays `#040914` (it must match the site background).

## Changes made to the game's files (and why)

| File | Change | Why |
|---|---|---|
| `client/src/game/neon.css` | Kept every `.gm-*` / `.px-*` rule; removed the "Part 1" re-skin of site elements (`body`, headings, `.panel`, `.topbar`, `.button`, `.chip`, `.list-row`, `.score`, …); colours renamed to private `--gm-*` variables. | The site and game now each keep their own look. The re-skin also redefined `--ink`, which the site theme uses for **text**: loaded last, it made all site text dark-on-dark. |
| `client/src/game/neon.css`, `client/src/game/pixel.js` | The neon green (`#2cf08a`: XP bar, "+XP" popup, OK buttons, check/cactus sprites) became sky blue `#5cc8ff`. | The project's colour brief: no neon green, neon blue highlights. |
| `client/src/game/PxModal.jsx` | Dialogs render into `<body>` via a React portal. | The site's glass panels use `backdrop-filter` / `clip-path`, which trapped `position: fixed` dialogs opened from a panel (Rex's Lair from a room box opened clipped inside the side panel). Keyboard, focus trap and click-outside still work. |

## New integration point

- `client/src/components/InteriorPanel.jsx` shows `<RoomGameBox>` for the room you're standing in while walking
  through the CSE Dept (marked `GAME`), so the game works there like it does on a room's page.

## Checks run on the merged tree

- `npm run verify:game` (server, no database): 40 passed.
- `npm run verify:8` (client checks + build): all passed.
- Browser test against the real game router + game service (on the in-memory fake models): create an explorer,
  scan a room (+70 XP), room game box on a room page and inside the CSE walk-through, `/play`, Rex's Lair — no page errors.
- Not run here: phases that need MongoDB (`verify:1`–`7`, `verify:10`). Run `npm run verify` locally.

## After pulling

```
cd client && npm install
cd ../server && npm install
npm run seed:campus -- --prune   # real campus layout + CSE room names
npm run verify:game
```
