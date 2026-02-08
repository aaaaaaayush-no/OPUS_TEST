/**
 * HorizontalSplitter - A draggable horizontal divider between two vertically stacked panels.
 * Allows the user to resize the top/bottom split by dragging.
 */
import { useCallback, useRef } from 'react';

interface HorizontalSplitterProps {
  onResize: (topHeightPercent: number) => void;
  currentPercent: number;
  min?: number;
  max?: number;
}

export default function HorizontalSplitter({ onResize, currentPercent, min = 20, max = 80 }: HorizontalSplitterProps) {
  const dragRef = useRef<{ startY: number; containerHeight: number } | null>(null);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 5 : 1;
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      onResize(Math.max(min, currentPercent - step));
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      onResize(Math.min(max, currentPercent + step));
    }
  }, [onResize, currentPercent, min, max]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const container = (e.target as HTMLElement).parentElement;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    dragRef.current = {
      startY: e.clientY,
      containerHeight: rect.height,
    };

    const handleMouseMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const { containerHeight } = dragRef.current;
      const newTop = ev.clientY - container.getBoundingClientRect().top;
      const percent = Math.min(Math.max((newTop / containerHeight) * 100, min), max);
      onResize(percent);
    };

    const handleMouseUp = () => {
      dragRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [onResize, min, max]);

  return (
    <div
      className="cf-splitter-horizontal"
      onMouseDown={handleMouseDown}
      onKeyDown={handleKeyDown}
      role="separator"
      aria-orientation="horizontal"
      aria-valuenow={Math.round(currentPercent)}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
    />
  );
}
