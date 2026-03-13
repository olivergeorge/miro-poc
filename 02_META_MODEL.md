# **Moving to a Meta-Model for the Whiteboard**

In our current POC, the data structure is essentially the "Wild West." We insert a Y.Map into the shared document and attach arbitrary keys (x, y, color) to it.

Moving to a **Meta-Model** means introducing a strict schema that defines exactly *what* entities can exist on the canvas and *how* they are allowed to interact. You are essentially building a graph database inside Yjs.

## **1\. The Current State vs. The Meta-Model State**

**Current State (Schemaless):**

You can put anything in the Yjs Map. If a bug causes a sticky note to be saved with { radius: 50 } instead of { w: 100, h: 100 }, the app might crash because the React component doesn't know how to render a radius for a square note.

**Meta-Model State (Constrained):**

The application strictly enforces a schema. Every element must adhere to a defined Entity type, and every connection must adhere to a defined Relation type.

## **2\. Defining the Entities (Nodes)**

In a meta-model, you categorize everything on the board into specific, typed entities.

// Base constraint for ALL entities  
interface BaseEntity {  
  id: string;  
  type: EntityType;  
  x: number;  
  y: number;  
  z\_index: number;  
}

// Specific constraints  
interface StickyNoteEntity extends BaseEntity {  
  type: 'sticky\_note';  
  text: string;  
  color: string;  
}

interface ShapeEntity extends BaseEntity {  
  type: 'shape';  
  shapeType: 'rectangle' | 'ellipse' | 'triangle';  
  width: number;  
  height: number;  
  backgroundColor: string;  
}

type CanvasEntity \= StickyNoteEntity | ShapeEntity;

## **3\. Defining the Relations (Edges/Hierarchy)**

Relations dictate how entities interact. In Miro, things don't just float independently; they are grouped, framed, or connected.

// A constraint defining how two entities are linked  
interface ConnectionRelation {  
  id: string;  
  type: 'connection';  
  sourceId: string;      // Must point to a valid BaseEntity ID  
  targetId: string;      // Must point to a valid BaseEntity ID  
  pathType: 'straight' | 'curved' | 'orthogonal';  
}

// A constraint defining grouping/framing  
interface ParentChildRelation {  
  id: string;  
  type: 'containment';  
  parentId: string;      // e.g., A 'Frame' entity ID  
  childIds: string\[\];    // IDs of entities inside the frame  
}

## **4\. How this changes the Codebase**

Implementing a meta-model requires three major architectural shifts in your React/Yjs app:

### **A. The Validation Layer**

Before writing to Yjs (or immediately after reacting to a remote Yjs change), the data must pass through a schema validator (like **Zod** or **Valibot**).

* *Example:* If a remote user's client tries to draw a connector line to an entity ID that has already been deleted, the validation layer catches this orphaned relation and automatically destroys the connector line to maintain integrity.

### **B. The Factory Render Pattern**

Instead of hardcoding \<StickyNote /\> loops in App.jsx, your canvas becomes a generic renderer. It reads the type from the meta-model and asks a Registry which component to mount.

// The Canvas becomes "dumb" and just follows the Meta-Model  
const ElementRenderer \= ({ entityData }) \=\> {  
  switch (entityData.type) {  
    case 'sticky\_note': return \<StickyNote data={entityData} /\>;  
    case 'shape': return \<Shape data={entityData} /\>;  
    case 'frame': return \<Frame data={entityData} /\>;  
    default: return \<UnknownElementWarning /\>;  
  }  
}

### **C. Graph Operations over Flat Maps**

You no longer just update x and y. If a user moves a Frame entity, your logic must traverse the ParentChildRelation to find all childIds and update their coordinates as well.

## **Summary of Benefits**

1. **Plugin Ecosystem:** A strict meta-model allows you to build a public API. Developers can create custom plugins because they know exactly what schema the board expects.  
2. **Referential Integrity:** It prevents "ghost lines" (connectors pointing to nothing) and corrupted saves.  
3. **Export/Import:** It becomes trivial to serialize the entire board to a clean JSON file and import it elsewhere, as the data strictly adheres to known contracts rather than UI-specific quirks.