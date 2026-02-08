/**
 * ResizableSplitter - A draggable divider between two panels.
 * Allows the user to resize the left/right split by dragging.
 */
import { useCallback, useRef } from 'react';

interface ResizableSplitterProps {
  onResize: (leftWidthPercent: number) => void;
}

export default function ResizableSplitter({ onResize }: ResizableSplitterProps) {
  const dragRef = useRef<{ startX: number; containerWidth: number; startLeft: number } | null>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const container = (e.target as HTMLElement).parentElement;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    dragRef.current = {
      startX: e.clientX,
      containerWidth: rect.width,
      startLeft: e.clientX - rect.left,
    };

    const handleMouseMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const { containerWidth } = dragRef.current;
      const newLeft = ev.clientX - container.getBoundingClientRect().left;
      const percent = Math.min(Math.max((newLeft / containerWidth) * 100, 20), 80);
      onResize(percent);
    };

    const handleMouseUp = () => {
      dragRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [onResize]);

  return (
    <div
      className="cf-splitter"
      onMouseDown={handleMouseDown}
      role="separator"
      aria-orientation="vertical"
      tabIndex={0}
    />
  );
}
