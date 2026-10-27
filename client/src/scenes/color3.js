// The same score colours as lib/colors.js, as three.js Color objects for the 3D scenes.
// Note: Color(hex) converts from sRGB into three's linear working space, exactly like CSS colours.
import { Color } from 'three';
import { scoreHex } from '../lib/colors.js';

export const scoreColor = (score) => new Color(scoreHex(score));
