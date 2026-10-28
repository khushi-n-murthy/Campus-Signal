// Kenney models (free, CC0) used in the 3D views. Files live in client/public/models/kenney/.
//   Furniture Kit: kenney.nl/assets/furniture-kit    Nature Kit: kenney.nl/assets/nature-kit
// Any model that is missing is replaced by a simple built-in shape, so the scene always renders.
// Check with: cd server && npm run verify:8
export const MODEL_BASE = '/models/kenney/';

// Kenney models are modelled at roughly half real size (a desk is 0.38 units tall).
// scale = uniform real-world factor, so proportions stay true (desk ~0.7 m high, chair seat ~0.45 m).
// targetWidth = fallback sizing (and what verify:8 reports) when no scale is given.
// turn = extra rotation in degrees if a model faces the wrong way (try 90, 180 or 270).
// tint = optional { materialName: colour } overrides, applied to a private copy of the model.
const REAL = 1.85;

export const MODELS = {
  desk: { file: 'desk.glb', targetWidth: 1.36, scale: REAL, turn: 180 }, // drawers face the student
  chair: { file: 'chairDesk.glb', targetWidth: 0.62, scale: REAL, turn: 180, tint: { carpet: '#2c4a6e' } }, // navy upholstery
  teacherDesk: { file: 'deskCorner.glb', targetWidth: 1.6, scale: 1.65, turn: 0 },
  plant: { file: 'pottedPlant.glb', targetWidth: 0.42, scale: 2.0, turn: 0 },
  monitor: { file: 'computerScreen.glb', targetWidth: 0.6, scale: 1.5, turn: 0 },
  keyboard: { file: 'computerKeyboard.glb', targetWidth: 0.42, scale: 1.5, turn: 0 },
  mouse: { file: 'computerMouse.glb', targetWidth: 0.08, scale: 1.5, turn: 0 },
  bookcase: { file: 'bookcaseOpen.glb', targetWidth: 1.0, turn: 0 }, // not bundled: a detailed built-in bookcase is drawn
  // campus trees, tinted to sit in the night-time scene
  treeOak: { file: 'nature/tree_oak.glb', targetWidth: 5, scale: 7, turn: 0, tint: { leafsGreen: '#3d7f9c', woodBark: '#5a4a3c' } },
  treePine: { file: 'nature/tree_pineDefaultA.glb', targetWidth: 4, scale: 6.5, turn: 0, tint: { leafsDark: '#2f6a86', woodBarkDark: '#4a3e33' } },
};
