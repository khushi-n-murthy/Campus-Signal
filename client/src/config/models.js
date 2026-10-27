// Kenney Furniture Kit (free, CC0) models used inside the 3D classroom.
// 1. Download the kit from kenney.nl, open its "Models/GLTF format" folder.
// 2. Copy the files you want into client/public/models/kenney/.
// 3. Make the names below match the files you copied (check with: cd server && npm run verify:8).
// Any model that is missing is replaced by a simple built-in shape, so the room always renders.
export const MODEL_BASE = '/models/kenney/';

export const MODELS = {
  desk: { file: 'desk.glb', targetWidth: 1.2, turn: 0 }, // student desk, ~1.2 m wide
  chair: { file: 'chairDesk.glb', targetWidth: 0.5, turn: 0 },
  teacherDesk: { file: 'deskCorner.glb', targetWidth: 1.6, turn: 0 },
  bookcase: { file: 'bookcaseOpen.glb', targetWidth: 1.0, turn: 0 },
  plant: { file: 'pottedPlant.glb', targetWidth: 0.5, turn: 0 },
};
// targetWidth = how wide (in metres) the model should appear. The app measures each model
// and scales it to this width, so it does not matter what units the kit was made in.
// turn = extra rotation in degrees if a model faces the wrong way (try 90, 180 or 270).
