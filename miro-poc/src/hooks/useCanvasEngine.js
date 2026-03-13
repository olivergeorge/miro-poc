import { useState, useEffect, useCallback } from 'react';
import { CanvasNodeSchema } from '../lib/schema';
import * as Y from 'yjs';

/**
 * Central engine that abstracts all Yjs reads/writes for canvas nodes.
 * Components interact with plain JS objects; this hook bridges to Y.Map/Y.Text.
 */
export function useCanvasEngine(ydoc) {
  const [nodes, setNodes] = useState({});

  useEffect(() => {
    if (!ydoc) return;
    const yNodes = ydoc.getMap('nodes');

    const syncNodes = () => {
      const validatedNodes = {};

      yNodes.forEach((yNodeMap, id) => {
        // Read Y.Map entries into a plain object
        const raw = {};
        if (yNodeMap instanceof Y.Map) {
          yNodeMap.forEach((value, key) => {
            raw[key] = value;
          });
        } else {
          // Fallback for plain JSON (shouldn't happen but be safe)
          Object.assign(raw, yNodeMap);
        }

        // Resolve Y.Text fields to strings for the UI
        const yText = ydoc.getText(`${id}-text`);
        raw.text = yText.toString();

        const parsed = CanvasNodeSchema.safeParse(raw);
        if (parsed.success) {
          validatedNodes[id] = parsed.data;
        } else {
          console.warn(`Invalid node data for ${id}`, parsed.error.issues);
        }
      });

      setNodes(validatedNodes);
    };

    yNodes.observeDeep(syncNodes);

    // Also observe all existing text objects for changes
    const textObservers = new Map();

    const setupTextObservers = () => {
      // Clean up old observers
      textObservers.forEach((unsub, key) => unsub());
      textObservers.clear();

      yNodes.forEach((_yNodeMap, id) => {
        const yText = ydoc.getText(`${id}-text`);
        const handler = () => syncNodes();
        yText.observe(handler);
        textObservers.set(id, () => yText.unobserve(handler));
      });
    };

    // Re-setup text observers when nodes change
    yNodes.observe(setupTextObservers);
    setupTextObservers();
    syncNodes(); // Initial sync

    return () => {
      yNodes.unobserveDeep(syncNodes);
      yNodes.unobserve(setupTextObservers);
      textObservers.forEach((unsub) => unsub());
    };
  }, [ydoc]);

  const addNode = useCallback((nodeData) => {
    if (!ydoc) return;
    const parsed = CanvasNodeSchema.parse(nodeData); // Validate before write
    const yNodes = ydoc.getMap('nodes');

    ydoc.transact(() => {
      const yNodeMap = new Y.Map();
      for (const [key, value] of Object.entries(parsed)) {
        if (key === 'text') continue; // Text stored separately as Y.Text
        yNodeMap.set(key, value);
      }
      yNodes.set(parsed.id, yNodeMap);

      // Initialize Y.Text with any provided text
      if (parsed.text) {
        const yText = ydoc.getText(`${parsed.id}-text`);
        yText.insert(0, parsed.text);
      }
    });
  }, [ydoc]);

  const updateNode = useCallback((id, updates) => {
    if (!ydoc) return;
    const yNodeMap = ydoc.getMap('nodes').get(id);
    if (!yNodeMap) return;

    ydoc.transact(() => {
      for (const [key, value] of Object.entries(updates)) {
        if (key === 'text') {
          // Update Y.Text for collaborative text editing
          const yText = ydoc.getText(`${id}-text`);
          yText.delete(0, yText.length);
          yText.insert(0, value);
        } else {
          yNodeMap.set(key, value);
        }
      }
    });
  }, [ydoc]);

  const deleteNode = useCallback((id) => {
    if (!ydoc) return;
    ydoc.transact(() => {
      ydoc.getMap('nodes').delete(id);
      // Note: Y.Text objects can't be explicitly deleted from a doc,
      // but they become orphaned and won't be synced to new clients
    });
  }, [ydoc]);

  return { nodes, addNode, updateNode, deleteNode };
}
