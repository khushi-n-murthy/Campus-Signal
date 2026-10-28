// Pick a ready-made character or build your own: body, tone, hair, headgear, eyewear, gear, outfit, mood, background.
import { Avatar } from './Sprite.jsx';
import { Swatches, Stepper } from './Pickers.jsx';
import { BODIES, SKIN, HAIR, OUTFIT, BG, HAIR_STYLES, OUTFITS, GEAR, EYEWEAR, HEADGEAR, MOODS, PRESETS, HUMAN, randomAvatar } from './pixel.js';

export default function CharacterCreator({ avatar, onChange }) {
  const set = (key) => (value) => onChange({ ...avatar, [key]: value });
  const human = HUMAN(avatar);
  return (
    <div className="gm-creator">
      <div>
        <div className="gm-stage"><Avatar avatar={avatar} scale={4} idle label="Your explorer" /></div>
        <button type="button" className="gm-btn small ghost" style={{ marginTop: 10, width: '100%' }} onClick={() => onChange(randomAvatar())}>Random</button>
      </div>
      <div>
        <div className="gm-pick">
          <span className="gm-pick-label">Ready-made cast</span>
          <div className="gm-cast">
            {PRESETS.map((p) => (
              <button key={p.name} type="button" title={p.name} aria-label={`Use ${p.name}`} onClick={() => onChange(p.a)}>
                <Avatar avatar={p.a} scale={1} />
              </button>
            ))}
          </div>
        </div>
        <div className="gm-pickgrid">
        <Stepper label="Body" names={BODIES} value={avatar.body} onChange={set('body')} />
        <Swatches label="Skin / material" colors={SKIN} value={avatar.skin} onChange={set('skin')} />
        {human && <Stepper label="Hair" names={HAIR_STYLES} value={avatar.hairStyle} onChange={set('hairStyle')} />}
        {human && <Swatches label="Hair colour" colors={HAIR} value={avatar.hairColor} onChange={set('hairColor')} />}
        <Stepper label="Headgear" names={HEADGEAR} value={avatar.headgear} onChange={set('headgear')} />
        <Stepper label="Eyewear" names={EYEWEAR} value={avatar.eyewear} onChange={set('eyewear')} />
        <Stepper label="Gear" names={GEAR} value={avatar.accessory} onChange={set('accessory')} />
        <Stepper label="Mood" names={MOODS} value={avatar.mood} onChange={set('mood')} />
        <Stepper label="Outfit" names={OUTFITS} value={avatar.outfit} onChange={set('outfit')} />
        <Swatches label="Outfit colour" colors={OUTFIT} value={avatar.outfitColor} onChange={set('outfitColor')} />
        <Swatches label="Background" colors={BG} value={avatar.bg} onChange={set('bg')} />
        </div>
      </div>
    </div>
  );
}
