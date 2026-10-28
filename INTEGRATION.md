# Adding Signal Wars to the CampusSignal repo

This folder holds only the game. Nothing here contains the map, rooms or theme work.

## What is inside

New files (just copy them in, same folder layout as the repo):

- `client/src/game/` (all game screens, sprites, dino game, neon.css)
- `server/src/game/` (rules and database logic)
- `server/src/routes/game.js` (game API)
- `server/verify/phase10-game.js` and `server/verify/fake-models.js` (checks)

Small edits to existing files are in `integration.patch`. They are only a few lines each, and every one is marked `GAME`. The files touched are: `client/index.html`, `client/package.json`, `client/src/main.jsx`, `client/src/App.jsx`, `client/src/ThreeView.jsx`, `client/src/pages/TestPage.jsx`, `client/src/lib/{api.js,live.jsx,routes.js}`, `server/package.json`, `server/src/{app.js,db.js,models.js}`, `server/src/routes/measurements.js`, `server/verify/all.js`.

## Steps

1. Make a branch for the game.

```
git checkout -b feature/signal-wars
```

2. Copy the folders from this package into the repo root (they merge into `client/` and `server/`).

3. Apply the small edits.

```
git apply --3way integration.patch
```

4. If a file conflicts because your teammate changed the same lines (most likely `ThreeView.jsx` or `App.jsx`), keep her version and re-add only the lines marked `GAME` by hand. Each is one or two lines, for example a component added to the top bar or to a panel.

5. Install the two new font packages and run.

```
cd client
npm install
```

6. Check the game rules (no database needed).

```
cd ../server
npm run verify:game
```

## If your teammate changes the theme

The game styles live in `client/src/game/neon.css` and use `gm-` and `px-` class names, so they will not clash with her styles. The only global choices are the colour variables at the top of that file and the pixel fonts.
