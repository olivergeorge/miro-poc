import React, { useEffect, useState, useRef } from 'react';

export default function StickyNote({ id, ydoc, initialData }) {
  const [pos, setPos] = useState({ x: initialData.x, y: initialData.y });
  const [text, setText] = useState('');
  const noteRef = useRef(null);
    
  // Get the specific Y.Map for this note's properties (x, y, color)
  const yNote = ydoc.getMap('elements').get(id);
  // Get the specific Y.Text for this note's text content
  const yText = ydoc.getText(`${id}-text`);

  useEffect(() => {
    if (!yNote) return;

    // Observe changes to position (made by other users)
    const handleMapChange = () => {
      setPos({ x: yNote.get('x'), y: yNote.get('y') });
    };
      
    // Observe changes to text (made by other users)
    const handleTextChange = () => {
      setText(yText.toString());
    };

    yNote.observe(handleMapChange);
    yText.observe(handleTextChange);
      
    // Initial sync
    handleTextChange();

    return () => {
      yNote.unobserve(handleMapChange);
      yText.unobserve(handleTextChange);
    };
  }, [yNote, yText]);

  const handlePointerDown = (e) => {
    e.target.setPointerCapture(e.pointerId);
      
    const startX = e.clientX - pos.x;
    const startY = e.clientY - pos.y;

    const handlePointerMove = (moveEvent) => {
      const newX = moveEvent.clientX - startX;
      const newY = moveEvent.clientY - startY;
        
      // Update local state for immediate feedback (Optimistic UI)
      setPos({ x: newX, y: newY });
        
      // Update Yjs (this will broadcast to others instantly)
      yNote.set('x', newX);
      yNote.set('y', newY);
    };

    const handlePointerUp = (upEvent) => {
      upEvent.target.releasePointerCapture(upEvent.pointerId);
      noteRef.current?.removeEventListener('pointermove', handlePointerMove);
      noteRef.current?.removeEventListener('pointerup', handlePointerUp);
    };

    noteRef.current?.addEventListener('pointermove', handlePointerMove);
    noteRef.current?.addEventListener('pointerup', handlePointerUp);
  };

  const handleTextChange = (e) => {
    // Basic Yjs Text sync logic
    // For a production app, use Quill or standard bindings for accurate cursor sync.
    // Here we completely replace the string for POC simplicity, but Yjs allows delta inserts.
    ydoc.transact(() => {
      yText.delete(0, yText.length);
      yText.insert(0, e.target.value);
    });
    setText(e.target.value);
  };

  return (
    <div
      ref={noteRef}
      onPointerDown={handlePointerDown}
      className={`absolute w-48 h-48 shadow-lg cursor-move rounded-md flex flex-col ${initialData.color}`}
      style={{ transform: `translate(${pos.x}px, ${pos.y}px)`, touchAction: 'none' }}
    >
      <div className="h-6 bg-black/10 w-full rounded-t-md border-b border-black/5" />
      <textarea
        className="w-full h-full bg-transparent resize-none p-3 outline-none pointer-events-auto"
        value={text}
        onChange={handleTextChange}
        onPointerDown={(e) => e.stopPropagation()} // Prevent dragging when clicking text
        placeholder="Type here..."
      />
    </div>
  );
}
