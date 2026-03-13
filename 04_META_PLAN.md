Here is a pragmatic, step-by-step implementation plan to transition your current POC into a data-driven engine. 

To keep this pragmatic, we won't rewrite the entire app at once. Instead, we will extract the data logic from the UI, introduce a strict schema, and implement the Factory Pattern. 

### **Phase 1: Define the Schema (The Meta-Model)**
First, we need to define the strict rules for what can exist on the board. We'll use **Zod** for runtime validation, which ensures that malformed data from remote clients never crashes the app.

1. **Install Zod:** `npm install zod`
2. **Create `src/lib/schema.js`:**
```javascript
import { z } from 'zod';

// 1. Base constraints for ALL nodes
export const BaseNodeSchema = z.object({
  id: z.string(),
  x: z.number(),
  y: z.number(),
  z_index: z.number().default(0),
});

// 2. Specific node types
export const StickyNoteSchema = BaseNodeSchema.extend({
  type: z.literal('sticky_note'),
  color: z.string(),
  text: z.string().default(''), 
});

export const ShapeSchema = BaseNodeSchema.extend({
  type: z.literal('shape'),
  shapeType: z.enum(['rectangle', 'ellipse']),
  width: z.number(),
  height: z.number(),
  backgroundColor: z.string(),
});

// 3. The generic Canvas Node
export const CanvasNodeSchema = z.discriminatedUnion('type', [
  StickyNoteSchema,
  ShapeSchema,
]);
```

### **Phase 2: Build the Canvas Engine (Data Abstraction)**
Right now, `StickyNote.jsx` mutates Yjs directly. We need to build an "Engine" that acts as the single source of truth for all Yjs reads/writes. This decouples React from Yjs.

**Create `src/hooks/useCanvasEngine.js`:**
```javascript
import { useState, useEffect, useCallback } from 'react';
import { CanvasNodeSchema } from '../lib/schema';
import * as Y from 'yjs';

export function useCanvasEngine(ydoc) {
  const [nodes, setNodes] = useState({});

  useEffect(() => {
    if (!ydoc) return;
    const yNodes = ydoc.getMap('nodes');

    const syncNodes = () => {
      const rawNodes = yNodes.toJSON();
      const validatedNodes = {};
      
      // READ VALIDATION: Ignore corrupted data from other clients
      for (const [id, data] of Object.entries(rawNodes)) {
        const parsed = CanvasNodeSchema.safeParse(data);
        if (parsed.success) {
          validatedNodes[id] = parsed.data;
        } else {
          console.warn(`Invalid node data for ${id}`, parsed.error);
        }
      }
      setNodes(validatedNodes);
    };

    yNodes.observeDeep(syncNodes);
    syncNodes(); // Initial sync

    return () => yNodes.unobserveDeep(syncNodes);
  }, [ydoc]);

  // WRITE OPERATIONS: Centralized API for the UI to call
  const addNode = useCallback((nodeData) => {
    const parsed = CanvasNodeSchema.parse(nodeData); // Validate before write
    
    // Convert JSON to Y.Map for granular updates
    const yNodeMap = new Y.Map();
    Object.entries(parsed).forEach(([key, value]) => yNodeMap.set(key, value));
    
    ydoc.getMap('nodes').set(parsed.id, yNodeMap);
  }, [ydoc]);

  const updateNode = useCallback((id, updates) => {
    const yNodeMap = ydoc.getMap('nodes').get(id);
    if (!yNodeMap) return;
    
    ydoc.transact(() => {
      Object.entries(updates).forEach(([key, value]) => {
        yNodeMap.set(key, value);
      });
    });
  }, [ydoc]);

  return { nodes, addNode, updateNode };
}
```
*(Note: For the text, we've moved it into the Y.Map as a string rather than a separate `Y.Text` object to simplify the schema. If you need rich-text collaboration later, you can map `text_id` in the schema to a `Y.Text` object).*

### **Phase 3: Implement the Factory Pattern (The UI Layer)**
Now we make the Canvas "dumb". It should not know about Sticky Notes; it only knows how to render nodes from the engine.

1. **Create `src/components/NodeRenderer.jsx`:**
```javascript
import React from 'react';
import StickyNote from './StickyNote';
import Shape from './Shape'; // You can build this later

export default function NodeRenderer({ node, updateNode }) {
  // The Factory Pattern switch statement
  switch (node.type) {
    case 'sticky_note':
      return <StickyNote data={node} updateNode={updateNode} />;
    case 'shape':
      return <Shape data={node} updateNode={updateNode} />;
    default:
      return null; // or an <UnknownElementWarning />
  }
}
```

2. **Refactor `App.jsx` to use the Engine and Renderer:**
```javascript
// Inside App.jsx
import { useCanvasEngine } from './hooks/useCanvasEngine';
import NodeRenderer from './components/NodeRenderer';

export default function Whiteboard() {
  // ... (Yjs init logic stays the same) ...
  
  const { nodes, addNode, updateNode } = useCanvasEngine(ydoc);

  const handleAddSticky = () => {
    addNode({
      id: `note-${Date.now()}`,
      type: 'sticky_note',
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
      color: 'bg-yellow-200',
      z_index: Object.keys(nodes).length,
    });
  };

  return (
    <div className="w-full h-screen bg-gray-50 overflow-hidden relative">
      <button onClick={handleAddSticky}>+ Add Sticky Note</button>
      
      {/* Factory Render Loop */}
      {Object.values(nodes).map((node) => (
        <NodeRenderer key={node.id} node={node} updateNode={updateNode} />
      ))}
    </div>
  );
}
```

### **Phase 4: Purify the Components**
Finally, strip Yjs completely out of your UI components. They should only receive props and call the `updateNode` callback.

**Refactored `src/StickyNote.jsx`:**
```javascript
import React, { useRef } from 'react';

// Notice: No Yjs imports. Just pure React.
export default function StickyNote({ data, updateNode }) {
  const noteRef = useRef(null);

  const handlePointerDown = (e) => {
    e.target.setPointerCapture(e.pointerId);
    const startX = e.clientX - data.x;
    const startY = e.clientY - data.y;

    const handlePointerMove = (moveEvent) => {
      // Optimistic UI update could go here, but for now we just push to the engine
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
      style={{ transform: `translate(${data.x}px, ${data.y}px)` }}
    >
      <div className="h-6 bg-black/10 w-full rounded-t-md pointer-events-none" />
      <textarea
        className="w-full h-full bg-transparent resize-none p-3 pointer-events-auto"
        value={data.text}
        onChange={(e) => updateNode(data.id, { text: e.target.value })}
        onPointerDown={(e) => e.stopPropagation()}
      />
    </div>
  );
}
```

### **Summary of the Transformation**
By executing these 4 phases, you achieve:
1. **Safety:** Zod schema validation ensures remote clients can't crash your app with bad data.
2. **Separation of Concerns:** Yjs is entirely contained within `useCanvasEngine`. Your UI components are now easily testable, pure React components.
3. **Extensibility:** To add a new tool (like an Arrow or Image), you just add it to `schema.js`, drop the component into `NodeRenderer.jsx`, and it instantly supports multiplayer syncing, saving, and validation.
