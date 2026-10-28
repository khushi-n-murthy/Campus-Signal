export function Swatches({ label, colors, value, onChange }) {
  return (
    <div className="gm-pick">
      <span className="gm-pick-label" id={`pl-${label}`}>{label}</span>
      <div className="gm-swatches" role="radiogroup" aria-labelledby={`pl-${label}`}>
        {colors.map((c, i) => (
          <button key={c} type="button" role="radio" aria-checked={value === i} aria-label={`${label} ${i + 1}`} className={value === i ? 'on' : ''} style={{ background: c }} onClick={() => onChange(i)} />
        ))}
      </div>
    </div>
  );
}

export function Stepper({ label, names, value, onChange }) {
  const n = names.length;
  return (
    <div className="gm-pick">
      <span className="gm-pick-label">{label}</span>
      <div className="gm-stepper">
        <button type="button" aria-label={`Previous ${label}`} onClick={() => onChange((value + n - 1) % n)}>&lsaquo;</button>
        <span aria-live="polite">{names[value]}</span>
        <button type="button" aria-label={`Next ${label}`} onClick={() => onChange((value + 1) % n)}>&rsaquo;</button>
      </div>
    </div>
  );
}
