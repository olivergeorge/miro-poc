import React, { useEffect, useState, useRef } from 'react';
import * as Y from 'yjs';
import { SupabaseProvider } from 'y-supabase';
import { supabase } from './lib/supabase';
import StickyNote from './StickyNote';

const BOARD_ID = '00000000-0000-0000-0000-000000000000'; // Replace with a real UUID from your boards table

export default function Whiteboard() {
  const [ydoc, setYdoc] = useState(null);
  const [provider, setProvider] = useState(null);
  const [elements, setElements] = useState({});
  const [awareness, setAwareness] = useState(new Map());

  useEffect(() => {
    // 1. Initialize the Yjs Document
    const doc = new Y.Doc();
      
    // 2. Connect Yjs to Supabase
    // This handles Broadcast (for speed) AND Postgres (for saving) automatically.
    const supProvider = new SupabaseProvider(doc, supabase, {
      channel: `board-${BOARD_ID}`,
      tableName: 'yjs_updates',
      columnName: 'document_update',
      id: BOARD_ID,
      idColumnName: 'board_id'
    });

    // 3. Setup Awareness (Live Cursors)
    supProvider.awareness.setLocalStateField('user', {
      name: `Guest ${Math.floor(Math.random() * 100)}`,
      color: '#' + Math.floor(Math.random()*16777215).toString(16)
    });

    supProvider.awareness.on('change', () => {
      setAwareness(new Map(supProvider.awareness.getStates()));
    });

    // 4. Listen to the Shared Elements Map
    const yElements = doc.getMap('elements');
    const updateElements = () => setElements(yElements.toJSON());
      
    yElements.observeDeep(updateElements);
      
    setYdoc(doc);
    setProvider(supProvider);

    return () => {
      supProvider.destroy();
      doc.destroy();
    };
  }, []);

  const addStickyNote = () => {
    if (!ydoc) return;
    const yElements = ydoc.getMap('elements');
    const id = `note-${Date.now()}`;
      
    // Insert a new Y.Map for this specific note into the parent elements map
    const newNote = new Y.Map();
    newNote.set('x', window.innerWidth / 2);
    newNote.set('y', window.innerHeight / 2);
    newNote.set('color', 'bg-yellow-200');
      
    yElements.set(id, newNote);
  };

  const handleMouseMove = (e) => {
    if (provider) {
      provider.awareness.setLocalStateField('cursor', {
        x: e.clientX,
        y: e.clientY
      });
    }
  };

  if (!ydoc) return <div className="p-10">Connecting to Realtime Board...</div>;

  return (
    <div 
      className="w-full h-screen bg-gray-50 overflow-hidden relative"
      onPointerMove={handleMouseMove}
    >
      {/* Toolbar */}
      <div className="absolute top-4 left-4 z-50 bg-white p-2 rounded-lg shadow-md">
        <button 
          onClick={addStickyNote}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
        >
          + Add Sticky Note
        </button>
      </div>

      {/* Render Sticky Notes */}
      {Object.keys(elements).map((id) => (
        <StickyNote 
          key={id} 
          id={id} 
          ydoc={ydoc} 
          initialData={elements[id]} 
        />
      ))}

      {/* Render Live Cursors */}
      {Array.from(awareness.entries()).map(([clientId, state]) => {
        if (clientId === provider.awareness.clientID || !state.cursor) return null;
        return (
          <div 
            key={clientId}
            className="absolute pointer-events-none z-50 transition-transform duration-75"
            style={{ transform: `translate(${state.cursor.x}px, ${state.cursor.y}px)` }}
          >
            <svg width="24" height="36" viewBox="0 0 24 36" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M5.65376 21.1598L3.39343 32.7483C3.07843 34.3642 5.03437 35.3129 6.20815 34.1118L21.7854 18.1755C22.8427 17.0938 22.2519 15.2255 20.7388 14.861L12.5539 12.8885L17.2282 3.52845C17.9258 2.13204 16.5113 0.655977 15.1438 1.35339L2.24588 7.93297C0.849688 8.64491 0.613393 10.5905 1.78657 11.6059L5.65376 21.1598Z" fill={state.user?.color || "#000"} stroke="white" strokeWidth="2"/>
            </svg>
            <div 
              className="ml-4 mt-1 px-2 py-1 rounded text-xs text-white whitespace-nowrap"
              style={{ backgroundColor: state.user?.color || "#000" }}
            >
              {state.user?.name}
            </div>
          </div>
        );
      })}
    </div>
  );
}
