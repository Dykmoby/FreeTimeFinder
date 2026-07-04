import { useEffect, useRef, useState } from 'react';

/**
 * The frosted sticky bar behind the day-of-week labels (shared by the editor
 * and the overview grid). While it rests at the top of the grid its top
 * corners are rounded; once scrolling pins it below the topbar it "hangs"
 * over the hour grid, so `is-stuck` flips the rounding to the bottom edge
 * (animated in CSS). CSS can't detect a sticky element pinning, so we compare
 * the bar's on-screen top with its natural spot at the grid's top edge.
 */
export default function GridHeadbar() {
  const ref = useRef(null);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const check = () => {
      raf = 0;
      const grid = el.parentElement;
      if (!grid) return;
      setStuck(el.getBoundingClientRect().top - grid.getBoundingClientRect().top > 1);
    };
    const queue = () => { if (!raf) raf = requestAnimationFrame(check); };
    check();
    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('scroll', queue);
      window.removeEventListener('resize', queue);
    };
  }, []);

  return (
    <div
      ref={ref}
      className={`grid__headbar ${stuck ? 'is-stuck' : ''}`}
      style={{ gridRow: 1, gridColumn: '2 / -1' }}
    />
  );
}
