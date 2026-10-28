// A pixel-framed dialog. Escape closes it, Tab stays inside, focus returns afterwards.
import { useEffect, useRef } from 'react';

export default function PxModal({ title, onClose, children, wide = false, tone = '' }) {
  const box = useRef(null);
  useEffect(() => {
    const prev = document.activeElement;
    const first = box.current?.querySelector('[data-autofocus], input, button, select');
    first?.focus({ preventScroll: true });
    const onKey = (e) => {
      if (e.key === 'Escape' && onClose) { e.stopPropagation(); onClose(); return; }
      if (e.key !== 'Tab') return;
      const f = box.current?.querySelectorAll('button:not([disabled]), input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])');
      if (!f || !f.length) return;
      const a = f[0], z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); prev?.focus?.({ preventScroll: true }); };
  }, [onClose]);
  return (
    <div className="gm-scrim" onPointerDown={(e) => { if (e.target === e.currentTarget && onClose) onClose(); }}>
      <div className={`gm-dialog px-box ${wide ? 'wide' : ''} ${tone}`} role="dialog" aria-modal="true" aria-label={title} ref={box}>
        {children}
      </div>
    </div>
  );
}
