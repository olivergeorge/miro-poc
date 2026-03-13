# **Miro-Style Collaborative Whiteboard POC**

**Tech Stack:** React, Supabase (Realtime \+ Postgres), Yjs (CRDT), Tailwind CSS

## **Architecture Notes: The "Unified Yjs" Approach**

In this complete implementation, we are moving **both** the element positions (X/Y) and the text content into the Yjs document.

1. **Why?** It ensures that if a user goes offline, moves a note, and edits text, *both* actions sync perfectly without conflicts when they reconnect.  
2. **How?** The y-supabase provider listens to your Yjs document. When you drag a note, Yjs calculates the difference (delta), hands it to Supabase Realtime (Broadcast) for instant sharing, and periodically saves the compiled binary blob to Postgres.

## **Phase 1: Supabase Database Setup**

To store Yjs documents, we need a table capable of holding binary data (bytea). Run this in your Supabase SQL Editor.

\-- Create a table for the whiteboards  
CREATE TABLE boards (  
  id uuid PRIMARY KEY DEFAULT gen\_random\_uuid(),  
  name text NOT NULL DEFAULT 'Untitled Board',  
  created\_at timestamptz DEFAULT now()  
);

\-- Create a table specifically formatted for y-supabase to store CRDT updates  
CREATE TABLE yjs\_updates (  
  id uuid PRIMARY KEY DEFAULT gen\_random\_uuid(),  
  board\_id uuid REFERENCES boards(id) ON DELETE CASCADE,  
  document\_update bytea NOT NULL, \-- Stores the Yjs binary diffs  
  created\_at timestamptz DEFAULT now()  
);

\-- Enable Realtime for the yjs\_updates table  
ALTER PUBLICATION supabase\_realtime ADD TABLE yjs\_updates;

\-- (Optional but recommended) Row Level Security (RLS)  
\-- For the POC, we can allow anonymous access, but secure this later\!  
ALTER TABLE boards ENABLE ROW LEVEL SECURITY;  
ALTER TABLE yjs\_updates ENABLE ROW LEVEL SECURITY;  
CREATE POLICY "Public access to boards" ON boards FOR ALL USING (true);  
CREATE POLICY "Public access to yjs\_updates" ON yjs\_updates FOR ALL USING (true);

## **Phase 2: Project Setup & Dependencies**

Initialize your React project (e.g., using Vite) and install the necessary dependencies:

npm create vite@latest miro-poc \-- \--template react  
cd miro-poc  
npm install @supabase/supabase-js yjs y-supabase lucide-react tailwindcss

*(Ensure Tailwind CSS is configured in your project for the styling to work).*

## **Phase 3: Supabase Client Configuration**

Create a file to initialize your Supabase connection.

**src/lib/supabase.js**

import { createClient } from '@supabase/supabase-js';

const supabaseUrl \= import.meta.env.VITE\_SUPABASE\_URL;  
const supabaseKey \= import.meta.env.VITE\_SUPABASE\_ANON\_KEY;

export const supabase \= createClient(supabaseUrl, supabaseKey);

## **Phase 4: Core React Implementation**

We will break the application into a Main Canvas component and a Sticky Note component.

### **1\. The Main Canvas Component**

This handles initializing Yjs, connecting to Supabase, and rendering the cursors and notes.

**src/App.jsx**

import React, { useEffect, useState, useRef } from 'react';  
import \* as Y from 'yjs';  
import { SupabaseProvider } from 'y-supabase';  
import { supabase } from './lib/supabase';  
import StickyNote from './StickyNote';

const BOARD\_ID \= '00000000-0000-0000-0000-000000000000'; // Replace with a real UUID from your boards table

export default function Whiteboard() {  
  const \[ydoc, setYdoc\] \= useState(null);  
  const \[provider, setProvider\] \= useState(null);  
  const \[elements, setElements\] \= useState({});  
  const \[awareness, setAwareness\] \= useState(new Map());

  useEffect(() \=\> {  
    // 1\. Initialize the Yjs Document  
    const doc \= new Y.Doc();  
      
    // 2\. Connect Yjs to Supabase  
    // This handles Broadcast (for speed) AND Postgres (for saving) automatically.  
    const supProvider \= new SupabaseProvider(doc, supabase, {  
      channel: \`board-${BOARD\_ID}\`,  
      tableName: 'yjs\_updates',  
      columnName: 'document\_update',  
      id: BOARD\_ID,  
      idColumnName: 'board\_id'  
    });

    // 3\. Setup Awareness (Live Cursors)  
    supProvider.awareness.setLocalStateField('user', {  
      name: \`Guest ${Math.floor(Math.random() \* 100)}\`,  
      color: '\#' \+ Math.floor(Math.random()\*16777215).toString(16)  
    });

    supProvider.awareness.on('change', () \=\> {  
      setAwareness(new Map(supProvider.awareness.getStates()));  
    });

    // 4\. Listen to the Shared Elements Map  
    const yElements \= doc.getMap('elements');  
    const updateElements \= () \=\> setElements(yElements.toJSON());  
      
    yElements.observeDeep(updateElements);  
      
    setYdoc(doc);  
    setProvider(supProvider);

    return () \=\> {  
      supProvider.destroy();  
      doc.destroy();  
    };  
  }, \[\]);

  const addStickyNote \= () \=\> {  
    if (\!ydoc) return;  
    const yElements \= ydoc.getMap('elements');  
    const id \= \`note-${Date.now()}\`;  
      
    // Insert a new Y.Map for this specific note into the parent elements map  
    const newNote \= new Y.Map();  
    newNote.set('x', window.innerWidth / 2);  
    newNote.set('y', window.innerHeight / 2);  
    newNote.set('color', 'bg-yellow-200');  
      
    yElements.set(id, newNote);  
  };

  const handleMouseMove \= (e) \=\> {  
    if (provider) {  
      provider.awareness.setLocalStateField('cursor', {  
        x: e.clientX,  
        y: e.clientY  
      });  
    }  
  };

  if (\!ydoc) return \<div className="p-10"\>Connecting to Realtime Board...\</div\>;

  return (  
    \<div   
      className="w-full h-screen bg-gray-50 overflow-hidden relative"  
      onPointerMove={handleMouseMove}  
    \>  
      {/\* Toolbar \*/}  
      \<div className="absolute top-4 left-4 z-50 bg-white p-2 rounded-lg shadow-md"\>  
        \<button   
          onClick={addStickyNote}  
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"  
        \>  
          \+ Add Sticky Note  
        \</button\>  
      \</div\>

      {/\* Render Sticky Notes \*/}  
      {Object.keys(elements).map((id) \=\> (  
        \<StickyNote   
          key={id}   
          id={id}   
          ydoc={ydoc}   
          initialData={elements\[id\]}   
        /\>  
      ))}

      {/\* Render Live Cursors \*/}  
      {Array.from(awareness.entries()).map((\[clientId, state\]) \=\> {  
        if (clientId \=== provider.awareness.clientID || \!state.cursor) return null;  
        return (  
          \<div   
            key={clientId}  
            className="absolute pointer-events-none z-50 transition-transform duration-75"  
            style={{ transform: \`translate(${state.cursor.x}px, ${state.cursor.y}px)\` }}  
          \>  
            \<svg width="24" height="36" viewBox="0 0 24 36" fill="none" xmlns="\[http://www.w3.org/2000/svg\](http://www.w3.org/2000/svg)"\>  
              \<path d="M5.65376 21.1598L3.39343 32.7483C3.07843 34.3642 5.03437 35.3129 6.20815 34.1118L21.7854 18.1755C22.8427 17.0938 22.2519 15.2255 20.7388 14.861L12.5539 12.8885L17.2282 3.52845C17.9258 2.13204 16.5113 0.655977 15.1438 1.35339L2.24588 7.93297C0.849688 8.64491 0.613393 10.5905 1.78657 11.6059L5.65376 21.1598Z" fill={state.user?.color || "\#000"} stroke="white" strokeWidth="2"/\>  
            \</svg\>  
            \<div   
              className="ml-4 mt-1 px-2 py-1 rounded text-xs text-white whitespace-nowrap"  
              style={{ backgroundColor: state.user?.color || "\#000" }}  
            \>  
              {state.user?.name}  
            \</div\>  
          \</div\>  
        );  
      })}  
    \</div\>  
  );  
}

### **2\. The Sticky Note Component**

This component binds specifically to the shared Yjs Map for its position, and a Yjs Text object for its content.

**src/StickyNote.jsx**

import React, { useEffect, useState, useRef } from 'react';

export default function StickyNote({ id, ydoc, initialData }) {  
  const \[pos, setPos\] \= useState({ x: initialData.x, y: initialData.y });  
  const \[text, setText\] \= useState('');  
  const noteRef \= useRef(null);  
    
  // Get the specific Y.Map for this note's properties (x, y, color)  
  const yNote \= ydoc.getMap('elements').get(id);  
  // Get the specific Y.Text for this note's text content  
  const yText \= ydoc.getText(\`${id}-text\`);

  useEffect(() \=\> {  
    if (\!yNote) return;

    // Observe changes to position (made by other users)  
    const handleMapChange \= () \=\> {  
      setPos({ x: yNote.get('x'), y: yNote.get('y') });  
    };  
      
    // Observe changes to text (made by other users)  
    const handleTextChange \= () \=\> {  
      setText(yText.toString());  
    };

    yNote.observe(handleMapChange);  
    yText.observe(handleTextChange);  
      
    // Initial sync  
    handleTextChange();

    return () \=\> {  
      yNote.unobserve(handleMapChange);  
      yText.unobserve(handleTextChange);  
    };  
  }, \[yNote, yText\]);

  const handlePointerDown \= (e) \=\> {  
    e.target.setPointerCapture(e.pointerId);  
      
    const startX \= e.clientX \- pos.x;  
    const startY \= e.clientY \- pos.y;

    const handlePointerMove \= (moveEvent) \=\> {  
      const newX \= moveEvent.clientX \- startX;  
      const newY \= moveEvent.clientY \- startY;  
        
      // Update local state for immediate feedback (Optimistic UI)  
      setPos({ x: newX, y: newY });  
        
      // Update Yjs (this will broadcast to others instantly)  
      yNote.set('x', newX);  
      yNote.set('y', newY);  
    };

    const handlePointerUp \= (upEvent) \=\> {  
      upEvent.target.releasePointerCapture(upEvent.pointerId);  
      noteRef.current?.removeEventListener('pointermove', handlePointerMove);  
      noteRef.current?.removeEventListener('pointerup', handlePointerUp);  
    };

    noteRef.current?.addEventListener('pointermove', handlePointerMove);  
    noteRef.current?.addEventListener('pointerup', handlePointerUp);  
  };

  const handleTextChange \= (e) \=\> {  
    // Basic Yjs Text sync logic  
    // For a production app, use Quill or standard bindings for accurate cursor sync.  
    // Here we completely replace the string for POC simplicity, but Yjs allows delta inserts.  
    ydoc.transact(() \=\> {  
      yText.delete(0, yText.length);  
      yText.insert(0, e.target.value);  
    });  
    setText(e.target.value);  
  };

  return (  
    \<div  
      ref={noteRef}  
      onPointerDown={handlePointerDown}  
      className={\`absolute w-48 h-48 shadow-lg cursor-move rounded-md flex flex-col ${initialData.color}\`}  
      style={{ transform: \`translate(${pos.x}px, ${pos.y}px)\`, touchAction: 'none' }}  
    \>  
      \<div className="h-6 bg-black/10 w-full rounded-t-md border-b border-black/5" /\>  
      \<textarea  
        className="w-full h-full bg-transparent resize-none p-3 outline-none pointer-events-auto"  
        value={text}  
        onChange={handleTextChange}  
        onPointerDown={(e) \=\> e.stopPropagation()} // Prevent dragging when clicking text  
        placeholder="Type here..."  
      /\>  
    \</div\>  
  );  
}

## **Phase 5: Implementation Notes & Next Steps**

1. **Pointer Capture:** In StickyNote.jsx, notice the use of setPointerCapture. This is a crucial API for web canvases. It ensures that if the user moves their mouse really fast and it leaves the boundaries of the sticky note, the note still follows the mouse until they let go.  
2. **Yjs Transactions:** In the handleTextChange function, we wrap the text replacement in ydoc.transact(). This groups the delete and insert operations together so remote users don't see brief flashes of empty text. *(Note: For production rich-text, you would bind Yjs directly to a text editor like Quill or ProseMirror).*  
3. **Database Cleanup:** Because Yjs saves every "diff", the yjs\_updates table will grow rapidly. In a production app, you will need an Edge Function that periodically runs Y.encodeStateAsUpdate() to squash the history down into a single compact state, deleting the old granular updates to save DB space.