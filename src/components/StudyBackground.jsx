import React, { useEffect, useRef, useState } from 'react';

const SVG_IDS = ["book", "bulb", "notebook", "cap", "pencil", "atom", "calc", "clock"];

function rng(seed) {
  return function () {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

export default function StudyBackground({ isDark }) {
  const containerRef = useRef(null);
  const [items, setItems] = useState(() => {
    if (typeof window === 'undefined') return [];
    const W = window.innerWidth;
    const H = window.innerHeight;
    let r = rng(42);
    const cell = W < 600 ? 125 : 170;
    const cols = Math.ceil(W / cell) + 1;
    const rows = Math.ceil(H / cell) + 1;
    let n = 0;
    const newItems = [];
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const size = 40 + r() * 34;
        const isSolid = r() < 0.18;
        const left = x * cell - cell / 2 + r() * cell * 0.6;
        const top = y * cell - cell / 2 + r() * cell * 0.6;
        const rotate = Math.round(r() * 50 - 25);
        const iconId = SVG_IDS[(x * 3 + y * 5 + n++) % SVG_IDS.length];
        newItems.push({ id: `icon-${x}-${y}`, iconId, size, left, top, rotate, isSolid });
      }
    }
    return newItems;
  });

  useEffect(() => {
    let t;
    const build = () => {
      if (!containerRef.current) return;
      const { clientWidth: W, clientHeight: H } = containerRef.current;
      // We want to re-initialize the seed every time we build so the layout is stable
      let r = rng(42);
      const cell = W < 600 ? 125 : 170;
      const cols = Math.ceil(W / cell) + 1;
      const rows = Math.ceil(H / cell) + 1;
      let n = 0;

      const newItems = [];
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const size = 40 + r() * 34;
          const isSolid = r() < 0.18;
          const left = x * cell - cell / 2 + r() * cell * 0.6;
          const top = y * cell - cell / 2 + r() * cell * 0.6;
          const rotate = Math.round(r() * 50 - 25);
          const iconId = SVG_IDS[(x * 3 + y * 5 + n++) % SVG_IDS.length];

          newItems.push({
            id: `icon-${x}-${y}`,
            iconId,
            size,
            left,
            top,
            rotate,
            isSolid,
          });
        }
      }
      setItems(newItems);
    };

    build();

    const observer = new ResizeObserver(() => {
      clearTimeout(t);
      t = setTimeout(build, 150);
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      clearTimeout(t);
      observer.disconnect();
    };
  }, []);

  const bg = 'var(--study-bg, #F2F2F2)';
  const iconColor = 'var(--study-icon, #c9c9ea)';
  const fillColor = 'var(--study-fill, #e8e8f7)';

  return (
    <div ref={containerRef} style={{ position: 'absolute', inset: 0, overflow: 'hidden', backgroundColor: bg, zIndex: 0 }}>
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <symbol id="bg-book" viewBox="0 0 64 64"><path d="M8 14c8-3 16-3 24 2 8-5 16-5 24-2v38c-8-3-16-3-24 2-8-5-16-5-24-2z" /><path d="M32 16v38" /></symbol>
          <symbol id="bg-pencil" viewBox="0 0 64 64"><path d="M12 52l4-12 28-28 8 8-28 28z" /><path d="M38 18l8 8M16 40l8 8" /></symbol>
          <symbol id="bg-cap" viewBox="0 0 64 64"><path d="M32 12L6 24l26 12 26-12z" /><path d="M16 30v14c0 4 8 8 16 8s16-4 16-8V30M58 24v16" /></symbol>
          <symbol id="bg-notebook" viewBox="0 0 64 64"><rect x="16" y="8" width="34" height="48" rx="4" /><path d="M16 18h-5M16 28h-5M16 38h-5M16 48h-5M26 20h16M26 30h16" /></symbol>
          <symbol id="bg-bulb" viewBox="0 0 64 64"><path d="M32 8a16 16 0 0 0-8 30v8h16v-8a16 16 0 0 0-8-30z" /><path d="M26 52h12M28 58h8" /></symbol>
          <symbol id="bg-calc" viewBox="0 0 64 64"><rect x="14" y="8" width="36" height="48" rx="4" /><rect x="20" y="14" width="24" height="10" rx="2" /><path d="M22 34h2M32 34h2M42 34h2M22 42h2M32 42h2M42 42h2M22 50h2M32 50h2" /></symbol>
          <symbol id="bg-atom" viewBox="0 0 64 64"><ellipse cx="32" cy="32" rx="26" ry="10" /><ellipse cx="32" cy="32" rx="26" ry="10" transform="rotate(60 32 32)" /><ellipse cx="32" cy="32" rx="26" ry="10" transform="rotate(120 32 32)" /><circle cx="32" cy="32" r="3" /></symbol>
          <symbol id="bg-clock" viewBox="0 0 64 64"><circle cx="32" cy="32" r="22" /><path d="M32 18v14l9 6" /></symbol>
        </defs>
      </svg>
      {items.map(item => (
        <svg
          key={item.id}
          style={{
            position: 'absolute',
            width: item.size,
            height: 'auto',
            left: item.left,
            top: item.top,
            transform: `rotate(${item.rotate}deg)`,
            fill: item.isSolid ? fillColor : 'none',
            stroke: item.isSolid ? 'none' : iconColor,
            strokeWidth: item.isSolid ? undefined : 2,
            strokeLinecap: item.isSolid ? undefined : 'round',
            strokeLinejoin: item.isSolid ? undefined : 'round',
          }}
        >
          <use href={`#bg-${item.iconId}`} />
        </svg>
      ))}
    </div>
  );
}





