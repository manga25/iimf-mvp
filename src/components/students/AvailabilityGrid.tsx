"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { DAYS, SLOTS_PER_DAY, SLOT_MIN, cellsToBlocks, slotStart, toTime, totalMinutes } from "@/lib/students/availability";
import { WEEKDAY_LABELS, WEEKDAY_SHORT, formatHours } from "@/lib/students/labels";

type Cells = boolean[][];
type Props = {
  value: Cells;
  onChange: (update: (prev: Cells) => Cells) => void;
  labelledBy: string;
  describedBy?: string;
};

const setCell = (prev: Cells, d: number, s: number, on: boolean): Cells => {
  if (prev[d][s] === on) return prev;
  const next = prev.map((row) => row.slice());
  next[d][s] = on;
  return next;
};
const cellLabel = (d: number, s: number) =>
  `${WEEKDAY_LABELS[d]} ${toTime(slotStart(s))}–${toTime(slotStart(s) + SLOT_MIN)}`;
const clamp = (n: number, max: number) => Math.max(0, Math.min(max - 1, n));

/**
 * Weekly availability: 7 days × 24 half-hour cells (SPEC §5).
 * Mouse: click or drag to paint. Touch: tap to toggle. Keyboard: arrows move,
 * Space/Enter toggles, Shift+arrow copies the current cell's state while moving.
 */
export function AvailabilityGrid({ value, onChange, labelledBy, describedBy }: Props) {
  const tableRef = useRef<HTMLTableElement>(null);
  const drag = useRef<boolean | null>(null); // paint mode while dragging
  const pointerType = useRef("mouse");
  const [focus, setFocus] = useState<[number, number]>([0, 0]);

  useEffect(() => {
    const end = () => (drag.current = null);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }, []);

  const focusCell = (d: number, s: number) => {
    setFocus([d, s]);
    tableRef.current?.querySelector<HTMLButtonElement>(`[data-cell="${d}-${s}"]`)?.focus();
  };

  const onPointerDown = (e: PointerEvent, d: number, s: number) => {
    pointerType.current = e.pointerType;
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    e.preventDefault(); // no text selection while dragging
    drag.current = !value[d][s];
    const mode = drag.current;
    onChange((prev) => setCell(prev, d, s, mode));
    focusCell(d, s);
  };

  const onPointerMove = (e: PointerEvent) => {
    if (drag.current === null) return;
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-cell]");
    if (!el || !tableRef.current?.contains(el)) return;
    const [d, s] = el.dataset.cell!.split("-").map(Number);
    const mode = drag.current;
    onChange((prev) => setCell(prev, d, s, mode));
  };

  const onKeyDown = (e: KeyboardEvent, d: number, s: number) => {
    const moves: Record<string, [number, number]> = {
      ArrowUp: [d, s - 1], ArrowDown: [d, s + 1], ArrowLeft: [d - 1, s], ArrowRight: [d + 1, s],
      Home: [0, s], End: [DAYS - 1, s],
    };
    const target = moves[e.key];
    if (!target) return;
    e.preventDefault();
    const [nd, ns] = [clamp(target[0], DAYS), clamp(target[1], SLOTS_PER_DAY)];
    if (e.shiftKey) {
      const mode = value[d][s];
      onChange((prev) => setCell(prev, nd, ns, mode));
    }
    focusCell(nd, ns);
  };

  const selected = totalMinutes(cellsToBlocks(value));

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-border bg-surface p-2" onPointerMove={onPointerMove}>
        <table ref={tableRef} className="w-full min-w-[19rem] table-fixed border-separate border-spacing-0.5 select-none" aria-labelledby={labelledBy} aria-describedby={describedBy}>
          <thead>
            <tr>
              <th scope="col" className="w-11"><span className="sr-only">Time</span></th>
              {WEEKDAY_SHORT.map((day, d) => (
                <th key={day} scope="col" className={`pb-1 text-xs font-semibold ${d >= 5 ? "text-muted" : ""}`}>
                  <abbr title={WEEKDAY_LABELS[d]} className="no-underline">{day}</abbr>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: SLOTS_PER_DAY }, (_, s) => (
              <tr key={s}>
                <th scope="row" className="pr-1 text-right align-middle font-mono text-[11px] font-normal text-muted">
                  {s % 2 === 0 ? toTime(slotStart(s)) : <span className="sr-only">{toTime(slotStart(s))}</span>}
                </th>
                {value.map((day, d) => {
                  const on = day[s];
                  const isFocus = focus[0] === d && focus[1] === s;
                  return (
                    <td key={d} className="p-0">
                      <button
                        type="button"
                        data-cell={`${d}-${s}`}
                        aria-label={cellLabel(d, s)}
                        aria-pressed={on}
                        tabIndex={isFocus ? 0 : -1}
                        onPointerDown={(e) => onPointerDown(e, d, s)}
                        onClick={(e) => {
                          // Mouse is handled on pointerdown; keyboard (detail 0) and touch toggle here.
                          if (e.detail !== 0 && pointerType.current === "mouse") return;
                          onChange((prev) => setCell(prev, d, s, !prev[d][s]));
                          setFocus([d, s]);
                        }}
                        onKeyDown={(e) => onKeyDown(e, d, s)}
                        className={`block h-7 w-full rounded-sm border transition-colors ${
                          on ? "border-primary bg-primary hover:bg-primary-hover" : "border-border bg-surface-muted hover:bg-primary-soft"
                        }`}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex items-center justify-between gap-3 text-sm">
        <p aria-live="polite" className="text-muted">
          {selected > 0 ? `${formatHours(selected)} per week selected` : "No availability selected yet"}
        </p>
        {selected > 0 && (
          <button type="button" className="btn-secondary px-3 py-1.5" onClick={() => onChange((prev) => prev.map((r) => r.map(() => false)))}>
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}
