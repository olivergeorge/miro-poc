import React from 'react';
import StickyNote from './StickyNote';

export default function NodeRenderer({ node, updateNode }) {
  switch (node.type) {
    case 'sticky_note':
      return <StickyNote data={node} updateNode={updateNode} />;
    default:
      console.warn(`Unknown node type: ${node.type}`);
      return null;
  }
}
