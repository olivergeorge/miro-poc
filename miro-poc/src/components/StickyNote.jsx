import React, { useRef } from 'react';

export default function StickyNote({ data, updateNode }) {
  const noteRef = useRef(null);

  const handlePointerDown = (e) => {
    e.target.setPointerCapture(e.pointerId);

    const startX = e.clientX - data.x;
    const startY = e.clientY - data.y;

    const handlePointerMove = (moveEvent) => {
      updateNode(data.id, {
        x: moveEvent.clientX - startX,
        y: moveEvent.clientY - startY,
      });
    };

    const handlePointerUp = (upEvent) => {
      upEvent.target.releasePointerCapture(upEvent.pointerId);
      noteRef.current?.removeEventListener('pointermove', handlePointerMove);
      noteRef.current?.removeEventListener('pointerup', handlePointerUp);
    };

    noteRef.current?.addEventListener('pointermove', handlePointerMove);
    noteRef.current?.addEventListener('pointerup', handlePointerUp);
  };

  return (
    <div
      ref={noteRef}
      onPointerDown={handlePointerDown}
      className={`absolute w-48 h-48 shadow-lg cursor-move rounded-md flex flex-col ${data.color}`}
      style={{ transform: `translate(${data.x}px, ${data.y}px)`, zIndex: data.zIndex, touchAction: 'none' }}
    >
      <div className="h-6 bg-black/10 w-full rounded-t-md border-b border-black/5" />
      <textarea
        className="w-full h-full bg-transparent resize-none p-3 outline-none pointer-events-auto"
        value={data.text}
        onChange={(e) => updateNode(data.id, { text: e.target.value })}
        onPointerDown={(e) => e.stopPropagation()}
        placeholder="Type here..."
      />
    </div>
  );
}
