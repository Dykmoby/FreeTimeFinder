import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  gridSlots,
  minToLabel,
  toISODate,
  weekdayShort,
  isToday,
  GRID_START_MIN,
  GRID_END_MIN,
  SLOT_MIN,
} from '../lib/time.js';
import { intervalsToSlotSet } from '../lib/intervals.js';
import Avatar from './Avatar.jsx';
import GridHeadbar from './GridHeadbar.jsx';

function buildSelected(isoList, byDay, slots) {
  const set = new Set();
  for (const iso of isoList) {
    for (const s of intervalsToSlotSet(byDay[iso] || [], slots)) set.add(`${iso}|${s}`);
  }
  return set;
}

// Past this much finger movement a touch counts as a scroll, not a tap.
const TAP_MOVE_PX = 8;
// Hold a cell this long (without scrolling) to start painting on touch.
const LONG_PRESS_MS = 320;

/**
 * Editable time grid.
 *  - Mouse: drag across cells to paint a range (gap-free); drag a block's top/
 *    bottom edge to resize it. Commits on release.
 *  - Touch: tap a cell to toggle it; press-and-hold then slide to paint a range.
 * With `onSetAudience` + `people`, each saved interval is drawn as a framed
 * block with a "who can see this" badge/popover (per-interval visibility).
 */
export default function SlotGrid({
  days,
  availabilityByDay,
  onCommitDay,
  onDayHeaderClick,
  people = [],
  onSetAudience,
  onResizeInterval,
  start = GRID_START_MIN,
  end = GRID_END_MIN,
}) {
  const slots = useMemo(() => gridSlots(start, end), [start, end]);
  const isoList = useMemo(() => days.map(toISODate), [days]);
  const isoKey = isoList.join(',');
  const rows = slots.length;
  const slotIndex = (min) => (min - start) / SLOT_MIN;
  const gridRef = useRef(null);

  const [selected, setSelected] = useState(() => buildSelected(isoList, availabilityByDay, slots));
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  useEffect(() => {
    setSelected(buildSelected(isoList, availabilityByDay, slots));
  }, [isoKey, availabilityByDay, slots]); // eslint-disable-line react-hooks/exhaustive-deps

  const apply = (iso, slot, mode) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const key = `${iso}|${slot}`;
      if (mode === 'add') next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const cellFromTarget = (el) => {
    const iso = el?.dataset?.iso;
    const slot = el?.dataset?.slot;
    if (iso == null || slot == null) return null;
    return { iso, slot: Number(slot) };
  };

  // --- Mouse: drag to paint a range -----------------------------------------
  const drag = useRef(null); // { mode, touched:Set, last:{iso,slot}|null }

  const startDrag = (iso, slot) => {
    const mode = selectedRef.current.has(`${iso}|${slot}`) ? 'remove' : 'add';
    drag.current = { mode, touched: new Set([`${iso}|${slot}`]), last: { iso, slot } };
    apply(iso, slot, mode);
  };

  const extendDrag = (cell) => {
    const d = drag.current;
    if (!d) return;
    if (!cell) { d.last = null; return; }
    const { iso, slot } = cell;
    if (d.last && d.last.iso === iso) {
      const a = Math.min(d.last.slot, slot);
      const b = Math.max(d.last.slot, slot);
      for (let s = a; s <= b; s += SLOT_MIN) { d.touched.add(`${iso}|${s}`); apply(iso, s, d.mode); }
    } else {
      d.touched.add(`${iso}|${slot}`);
      apply(iso, slot, d.mode);
    }
    d.last = { iso, slot };
  };

  const commitTouched = (mode, touched) => {
    const byIso = new Map();
    for (const key of touched) {
      const [iso, slot] = key.split('|');
      if (!byIso.has(iso)) byIso.set(iso, []);
      byIso.get(iso).push(Number(slot));
    }
    for (const [iso, list] of byIso) onCommitDay(iso, mode, list);
  };

  // Commit a mouse drag on release (anywhere on the page).
  useEffect(() => {
    const finish = () => {
      if (!drag.current) return;
      const { mode, touched } = drag.current;
      drag.current = null;
      commitTouched(mode, touched);
    };
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
    return () => {
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
    };
  }, [onCommitDay]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Touch: tap to toggle, or press-and-hold then slide to paint ----------
  const tap = useRef(null);
  const lpTimer = useRef(null);
  const touchPaint = useRef(null); // { active, mode, last, touched, before }
  const [touchPainting, setTouchPainting] = useState(false);
  const activePointers = useRef(new Set()); // touch ids currently down (pinch guard)
  const gestureBlocked = useRef(false); // true while ≥2 fingers are down
  const lastPointerType = useRef('mouse'); // to ignore the synthetic hover after a tap

  const tapStart = (e, iso, slot) => {
    tap.current = { iso, slot, x: e.clientX, y: e.clientY, moved: false };
  };
  const tapMove = (e) => {
    const t = tap.current;
    if (!t) return;
    if (Math.abs(e.clientX - t.x) > TAP_MOVE_PX || Math.abs(e.clientY - t.y) > TAP_MOVE_PX) {
      t.moved = true;
    }
  };
  const tapEnd = (iso, slot) => {
    const t = tap.current;
    tap.current = null;
    if (gestureBlocked.current) return; // part of a pinch — don't toggle
    if (!t || t.moved || t.iso !== iso || t.slot !== slot) return;
    const mode = selectedRef.current.has(`${iso}|${slot}`) ? 'remove' : 'add';
    apply(iso, slot, mode);
    onCommitDay(iso, mode, [slot]);
  };

  const clearLongPress = () => {
    if (lpTimer.current) { clearTimeout(lpTimer.current); lpTimer.current = null; }
  };

  const beginTouchPaint = (iso, slot) => {
    lpTimer.current = null;
    tap.current = null; // a hold is not a tap
    const before = new Set(selectedRef.current); // snapshot, to revert if a pinch interrupts
    const mode = selectedRef.current.has(`${iso}|${slot}`) ? 'remove' : 'add';
    touchPaint.current = { active: true, mode, last: { iso, slot }, touched: new Set([`${iso}|${slot}`]), before };
    apply(iso, slot, mode);
    setTouchPainting(true);
    if (navigator.vibrate) navigator.vibrate(12);
  };

  // A saved interval covering this cell — what a long-press should select.
  const intervalAt = (iso, slot) =>
    (availabilityByDay[iso] || []).find(
      (x) => x.id != null && slot >= x.startMin && slot + SLOT_MIN <= x.endMin,
    );

  // Long-press on touch: hold on an existing interval to select it — opens the
  // visibility panel and reveals the resize handles (the touch stand-in for
  // hovering on desktop). Hold on empty cells to paint a new interval.
  const beginLongPress = (iso, slot) => {
    lpTimer.current = null;
    if (gestureBlocked.current) return; // second finger down → pinch/zoom, not an edit
    const iv = editable ? intervalAt(iso, slot) : null;
    if (iv) {
      tap.current = null;
      openEditing({ id: iv.id, iso, visibleTo: iv.visibleTo });
      if (navigator.vibrate) navigator.vibrate(12);
    } else {
      beginTouchPaint(iso, slot);
    }
  };

  const extendTouchPaint = (cell) => {
    const d = touchPaint.current;
    if (!d || !d.active) return;
    if (!cell) { d.last = null; return; }
    const { iso, slot } = cell;
    if (d.last && d.last.iso === iso) {
      const a = Math.min(d.last.slot, slot);
      const b = Math.max(d.last.slot, slot);
      for (let s = a; s <= b; s += SLOT_MIN) { d.touched.add(`${iso}|${s}`); apply(iso, s, d.mode); }
    } else {
      d.touched.add(`${iso}|${slot}`);
      apply(iso, slot, d.mode);
    }
    d.last = { iso, slot };
  };

  const endTouchPaint = () => {
    const tp = touchPaint.current;
    touchPaint.current = null;
    setTouchPainting(false);
    if (tp) commitTouched(tp.mode, tp.touched);
  };

  const tapCancel = () => {
    tap.current = null;
    clearLongPress();
    if (touchPaint.current) { touchPaint.current = null; setTouchPainting(false); }
  };

  // Discard an in-progress touch paint without committing, restoring the slots
  // to what they were when it began (used when a pinch interrupts).
  const abortTouchPaint = () => {
    const tp = touchPaint.current;
    if (!tp) return;
    touchPaint.current = null;
    setTouchPainting(false);
    if (tp.before) setSelected(tp.before);
  };

  // Stop the page from scrolling while painting or resizing on touch.
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const onTouchMove = (e) => { if (touchPaint.current?.active || resize.current) e.preventDefault(); };
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => el.removeEventListener('touchmove', onTouchMove);
  }, []);

  // Pinch/zoom guard: a second finger means the gesture is a zoom or pan, never
  // a mark. Block tap/long-press/paint until every finger lifts, and undo any
  // paint already begun under the first finger.
  useEffect(() => {
    const down = (e) => {
      lastPointerType.current = e.pointerType;
      if (e.pointerType === 'mouse') return;
      activePointers.current.add(e.pointerId);
      if (activePointers.current.size > 1) {
        gestureBlocked.current = true;
        clearLongPress();
        tap.current = null;
        abortTouchPaint();
      }
    };
    const up = (e) => {
      activePointers.current.delete(e.pointerId);
      if (activePointers.current.size === 0) gestureBlocked.current = false;
    };
    window.addEventListener('pointerdown', down, true);
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', up, true);
    return () => {
      window.removeEventListener('pointerdown', down, true);
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('pointercancel', up, true);
    };
  }, []);

  const handleMove = (e) => {
    lastPointerType.current = e.pointerType;
    if (e.pointerType === 'mouse') { extendDrag(cellFromTarget(e.target)); return; }
    if (touchPaint.current?.active) {
      extendTouchPaint(cellFromTarget(document.elementFromPoint(e.clientX, e.clientY)));
      return;
    }
    tapMove(e);
    if (tap.current?.moved) clearLongPress(); // the finger is scrolling, not holding
  };

  // --- Per-interval visibility ----------------------------------------------
  // Editing holds a *draft* audience while the popover is open and only commits
  // on close — so toggling people doesn't reload/merge mid-edit (which would
  // change the interval's id and close the popover).
  const editable = typeof onSetAudience === 'function';
  const [hoverId, setHoverId] = useState(null);
  const [editing, setEditing] = useState(null); // { id, iso, saved, draft }
  const editingRef = useRef(null);
  editingRef.current = editing;

  const normAud = (a) => (a && a.length ? [...new Set(a)].sort((x, y) => x - y) : null);
  const sameAud = (a, b) => {
    const na = normAud(a);
    const nb = normAud(b);
    if (!na && !nb) return true;
    if (!na || !nb || na.length !== nb.length) return false;
    return na.every((v, i) => v === nb[i]);
  };

  const commitEditing = () => {
    const e = editingRef.current;
    setEditing(null);
    setHoverId(null); // also drop the selection frame (and touch resize handles)
    if (e && !sameAud(e.draft, e.saved)) onSetAudience(e.id, e.iso, normAud(e.draft));
  };

  const openEditing = (b) => {
    const cur = editingRef.current;
    if (cur) commitEditing();
    if (!cur || cur.id !== b.id) {
      setHoverId(b.id); // frame the block + show its handles while the panel is open
      setEditing({ id: b.id, iso: b.iso, saved: b.visibleTo || null, draft: b.visibleTo || null });
    }
  };

  const toggleDraftPerson = (pid) => {
    setEditing((e) => {
      if (!e) return e;
      const cur = e.draft ? [...e.draft] : [];
      const draft = cur.includes(pid) ? cur.filter((x) => x !== pid) : [...cur, pid];
      return { ...e, draft: draft.length ? draft : null };
    });
  };

  useEffect(() => {
    if (!editing) return;
    // A touch long-press is followed by a synthetic *mouse* pointerdown at the
    // same spot; ignoring it stops the panel from opening then closing at once.
    // Real tap-to-close events are pointerType 'touch'.
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const onDown = (e) => {
      if (coarse && e.pointerType === 'mouse') return;
      // Keep the panel open while grabbing a resize handle (.iv-resize).
      if (!e.target.closest?.('.iv-pop, .iv-badge, .iv-resize')) commitEditing();
    };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, [editing]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleHover = (e) => {
    if (lastPointerType.current !== 'mouse') return; // ignore the synthetic hover a tap fires
    if (resize.current) return; // resizing: don't repaint the hover frame under the cursor
    if (e.target.closest?.('.iv-block')) return; // keep hover steady over a block's UI
    const cell = cellFromTarget(e.target);
    if (!cell) return setHoverId(null);
    const iv = (availabilityByDay[cell.iso] || []).find(
      (x) => cell.slot >= x.startMin && cell.slot + SLOT_MIN <= x.endMin,
    );
    setHoverId(iv ? iv.id : null);
  };

  // --- Resize a block by dragging its edge ----------------------------------
  // Mouse: handles appear on hover. Touch: handles appear once the interval is
  // selected by a long-press (which also opens the visibility panel).
  const resize = useRef(null);
  const previewRef = useRef(null);
  const [preview, setPreview] = useState(null); // { id, startMin, endMin }
  const [resizing, setResizing] = useState(false);

  const startResize = (e, block, edge) => {
    if (!onResizeInterval || gestureBlocked.current) return;
    e.preventDefault();
    e.stopPropagation();
    const day = [...(availabilityByDay[block.iso] || [])].sort((a, b) => a.startMin - b.startMin);
    const idx = day.findIndex((iv) => iv.id === block.id);
    if (idx < 0) return;
    const self = day[idx];
    resize.current = {
      id: block.id,
      iso: block.iso,
      edge,
      fixedStart: self.startMin,
      fixedEnd: self.endMin,
      prevEnd: idx > 0 ? day[idx - 1].endMin : start,
      nextStart: idx < day.length - 1 ? day[idx + 1].startMin : end,
    };
    previewRef.current = { id: block.id, startMin: self.startMin, endMin: self.endMin };
    setPreview(previewRef.current);
    setResizing(true);
  };

  useEffect(() => {
    if (!resizing) return;
    const move = (e) => {
      const r = resize.current;
      if (!r) return;
      const cell = cellFromTarget(document.elementFromPoint(e.clientX, e.clientY));
      if (!cell || cell.iso !== r.iso) return;
      let ps = r.fixedStart;
      let pe = r.fixedEnd;
      if (r.edge === 'end') {
        pe = Math.max(r.fixedStart + SLOT_MIN, Math.min(cell.slot + SLOT_MIN, r.nextStart));
      } else {
        ps = Math.min(r.fixedEnd - SLOT_MIN, Math.max(cell.slot, r.prevEnd));
      }
      const lo = r.edge === 'end' ? r.fixedStart : r.prevEnd;
      const hi = r.edge === 'end' ? r.nextStart : r.fixedEnd;
      setSelected((prev) => {
        const next = new Set(prev);
        for (let s = lo; s < hi; s += SLOT_MIN) {
          const key = `${r.iso}|${s}`;
          if (s >= ps && s < pe) next.add(key);
          else next.delete(key);
        }
        return next;
      });
      previewRef.current = { id: r.id, startMin: ps, endMin: pe };
      setPreview(previewRef.current);
    };
    const up = () => {
      const r = resize.current;
      const p = previewRef.current;
      resize.current = null;
      previewRef.current = null;
      setResizing(false);
      setPreview(null);
      if (r && p) onResizeInterval(r.iso, r.id, p.startMin, p.endMin);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [resizing]); // eslint-disable-line react-hooks/exhaustive-deps

  // Saved intervals → positioned blocks (aligned to the slots they fully cover).
  const blocks = useMemo(() => {
    if (!editable) return [];
    const res = [];
    isoList.forEach((iso, dayIndex) => {
      for (const iv of availabilityByDay[iso] || []) {
        const first = Math.ceil(iv.startMin / SLOT_MIN) * SLOT_MIN;
        const last = Math.floor((iv.endMin - SLOT_MIN) / SLOT_MIN) * SLOT_MIN;
        const s0 = Math.max(first, start);
        const s1 = Math.min(last, end - SLOT_MIN);
        if (s1 < s0) continue; // covers no full slot → nothing to frame
        res.push({
          id: iv.id,
          iso,
          dayIndex,
          rowStart: slotIndex(s0),
          rowEnd: slotIndex(s1) + 1,
          visibleTo: iv.visibleTo || null,
        });
      }
    });
    return res;
  }, [availabilityByDay, isoList, editable, rows, start, end]); // eslint-disable-line react-hooks/exhaustive-deps

  const blockGeom = (b) => {
    if (!preview || preview.id !== b.id) return b;
    const s0 = Math.max(Math.ceil(preview.startMin / SLOT_MIN) * SLOT_MIN, start);
    const s1 = Math.min(Math.floor((preview.endMin - SLOT_MIN) / SLOT_MIN) * SLOT_MIN, end - SLOT_MIN);
    if (s1 < s0) return b;
    return { ...b, rowStart: slotIndex(s0), rowEnd: slotIndex(s1) + 1 };
  };

  return (
    <div
      ref={gridRef}
      className={`grid ${touchPainting ? 'is-painting' : ''} ${resizing ? 'is-resizing' : ''}`}
      style={{ '--cols': days.length, '--rows': rows }}
      onPointerMove={handleMove}
      onPointerCancel={tapCancel}
      onMouseOver={editable ? handleHover : undefined}
      onMouseLeave={editable ? () => setHoverId(null) : undefined}
    >
      <div className="grid__corner" style={{ gridRow: 1, gridColumn: 1 }} />
      <GridHeadbar />
      {days.map((d, di) => (
        <button
          key={toISODate(d)}
          className={`grid__dayhead ${isToday(d) ? 'is-today' : ''}`}
          style={{ gridRow: 1, gridColumn: di + 2 }}
          onClick={() => onDayHeaderClick?.(d)}
          type="button"
        >
          <span className="grid__dow">{weekdayShort(d)}</span>
          <span className="grid__date">{d.getDate()}</span>
        </button>
      ))}

      {slots.map((slot, i) => {
        const onHour = slot % 60 === 0;
        const r = i + 2;
        return (
          <Fragment key={slot}>
            <div
              className={`grid__time ${onHour ? 'grid__time--hour' : ''}`}
              style={{ gridRow: r, gridColumn: 1 }}
            >
              {onHour ? minToLabel(slot) : ''}
            </div>
            {isoList.map((iso, d) => {
              const on = selected.has(`${iso}|${slot}`);
              // Round only the ends of a run, so a painted interval reads as one
              // rounded band instead of every cell being a separate pill.
              const onTop = on && !selected.has(`${iso}|${slot - SLOT_MIN}`);
              const onBottom = on && !selected.has(`${iso}|${slot + SLOT_MIN}`);
              return (
                <div
                  key={iso}
                  data-iso={iso}
                  data-slot={slot}
                  style={{ gridRow: r, gridColumn: d + 2 }}
                  className={`slot ${on ? 'slot--on' : ''} ${onTop ? 'slot--on-top' : ''} ${onBottom ? 'slot--on-bottom' : ''} ${onHour ? 'slot--hour' : ''}`}
                  onPointerDown={(e) => {
                    if (e.pointerType === 'mouse') {
                      e.preventDefault();
                      startDrag(iso, slot);
                    } else {
                      if (gestureBlocked.current) return; // pinch in progress — ignore
                      tapStart(e, iso, slot);
                      lpTimer.current = setTimeout(() => beginLongPress(iso, slot), LONG_PRESS_MS);
                    }
                  }}
                  onPointerUp={(e) => {
                    if (e.pointerType === 'mouse') return;
                    clearLongPress();
                    if (touchPaint.current?.active) endTouchPaint();
                    else tapEnd(iso, slot);
                  }}
                />
              );
            })}
          </Fragment>
        );
      })}

      {blocks.map((b) => {
        const isOpen = editable && b.id != null && editing?.id === b.id;
        return (
          <IntervalBlock
            key={b.id != null ? `${b.iso}-id-${b.id}` : `${b.iso}-new-${b.rowStart}`}
            block={blockGeom(b)}
            people={people}
            open={isOpen}
            hover={b.id != null && hoverId === b.id}
            displayAudience={isOpen ? editing.draft : b.visibleTo || null}
            onToggleOpen={() => openEditing(b)}
            onTogglePerson={toggleDraftPerson}
            onRequestClose={commitEditing}
            onResizeStart={onResizeInterval ? startResize : undefined}
          />
        );
      })}
    </div>
  );
}

function IntervalBlock({ block, people, open, hover, displayAudience, onToggleOpen, onTogglePerson, onRequestClose, onResizeStart }) {
  const { id, dayIndex, rowStart, rowEnd } = block;
  const aud = displayAudience && displayAudience.length ? displayAudience : null;
  const restricted = !!aud;
  const audience = restricted ? people.filter((p) => aud.includes(p.id)) : [];
  const badgeRef = useRef(null);
  const blockEl = useRef(null);
  const popRef = useRef(null);
  const [pos, setPos] = useState(null);

  // Place the popover. Desktop (the badge is visible) keeps the original
  // badge-anchored placement. Touch (the badge is hidden → zero-size rect)
  // anchors to the block and sits just outside it, so it never covers the
  // resize handles. Fixed-positioned, clamped to the viewport on scroll/resize.
  useLayoutEffect(() => {
    if (!open) { setPos(null); return; }
    const place = () => {
      const pop = popRef.current;
      if (!pop) return;
      const p = pop.getBoundingClientRect();
      const m = 8; // viewport margin
      const badge = badgeRef.current;
      const b = badge ? badge.getBoundingClientRect() : null;
      let top;
      let left;
      if (b && b.width > 0) {
        // Desktop: anchored under the badge (flip above if it won't fit).
        top = b.bottom + 6;
        if (top + p.height > window.innerHeight - m) top = b.top - 6 - p.height;
        left = b.right - p.width;
      } else {
        // Touch: anchored to the block, placed outside it to clear the handles.
        const host = blockEl.current;
        if (!host) return;
        const r = host.getBoundingClientRect();
        const gap = 12; // clearance so the top/bottom handles stay grabbable
        top = r.bottom + gap; // prefer below
        if (top + p.height > window.innerHeight - m) {
          const above = r.top - gap - p.height; // else flip above
          top = above >= m ? above : top;
        }
        left = r.right - p.width;
      }
      top = Math.max(m, Math.min(top, window.innerHeight - p.height - m));
      left = Math.max(m, Math.min(left, window.innerWidth - p.width - m));
      setPos({ top, left });
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, restricted, audience.length, people.length]);

  // Mouse only (desktop): close when the pointer drifts more than 30px from the
  // badge or popover. Skip on touch — a tap fires synthetic mousemoves that
  // would otherwise close the panel the instant a long-press opens it.
  useEffect(() => {
    if (!open || !pos) return;
    if (!window.matchMedia('(pointer: fine)').matches) return;
    const onMove = (e) => {
      const pop = popRef.current;
      if (!pop) return;
      const rects = [pop.getBoundingClientRect()];
      const badge = badgeRef.current;
      if (badge && badge.getBoundingClientRect().width > 0) rects.push(badge.getBoundingClientRect());
      const left = Math.min(...rects.map((r) => r.left));
      const top = Math.min(...rects.map((r) => r.top));
      const right = Math.max(...rects.map((r) => r.right));
      const bottom = Math.max(...rects.map((r) => r.bottom));
      const dx = Math.max(left - e.clientX, 0, e.clientX - right);
      const dy = Math.max(top - e.clientY, 0, e.clientY - bottom);
      if (Math.hypot(dx, dy) > 30) onRequestClose?.();
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [open, pos, onRequestClose]);

  return (
    <div
      ref={blockEl}
      className={`iv-block ${restricted ? 'is-restricted' : ''} ${hover ? 'is-hover' : ''} ${open ? 'is-open' : ''}`}
      style={{ gridColumn: dayIndex + 2, gridRow: `${rowStart + 2} / ${rowEnd + 2}` }}
    >
      {onResizeStart && id != null && (
        <>
          <div className="iv-resize iv-resize--top" onPointerDown={(e) => onResizeStart(e, block, 'start')} title="Потяните, чтобы изменить начало" />
          <div className="iv-resize iv-resize--bottom" onPointerDown={(e) => onResizeStart(e, block, 'end')} title="Потяните, чтобы изменить конец" />
        </>
      )}

      {id != null && (
        <button ref={badgeRef} type="button" className="iv-badge" onClick={onToggleOpen} title="Кому видно">
          {restricted ? (
            <span className="iv-badge__avatars">
              {audience.slice(0, 3).map((p) => (
                <Avatar key={p.id} user={p} size={18} />
              ))}
              {audience.length > 3 && <span className="iv-badge__more">+{audience.length - 3}</span>}
            </span>
          ) : (
            <span className="iv-badge__all">Все</span>
          )}
        </button>
      )}

      {open && createPortal(
        <div
          ref={popRef}
          className="iv-pop"
          style={pos ? { top: pos.top, left: pos.left } : { visibility: 'hidden' }}
        >
          <div className="iv-pop__title">Кому видно этот интервал</div>
          <div className="iv-pop__chips">
            {people.length === 0 && <span className="muted">Других пользователей нет.</span>}
            {people.map((p) => {
              const on = restricted && aud.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`chip chip--sm ${on ? 'chip--on' : ''}`}
                  onClick={() => onTogglePerson(p.id)}
                >
                  <Avatar user={p} size={18} /> {p.nickname}
                </button>
              );
            })}
          </div>
          <p className="iv-pop__hint">
            {restricted ? 'Видно только выбранным.' : 'Сейчас видно всем — выберите людей, чтобы ограничить.'}
          </p>
        </div>,
        document.body,
      )}
    </div>
  );
}

export { SLOT_MIN };
