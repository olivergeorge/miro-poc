import { z } from 'zod';

// Base constraints for ALL canvas nodes
export const BaseNodeSchema = z.object({
  id: z.string(),
  type: z.string(),
  x: z.number(),
  y: z.number(),
  zIndex: z.number().default(0),
});

// Sticky note node
export const StickyNoteSchema = BaseNodeSchema.extend({
  type: z.literal('sticky_note'),
  color: z.string(),
  text: z.string().default(''),
});

// Generic shape node
export const ShapeSchema = BaseNodeSchema.extend({
  type: z.literal('shape'),
  shapeType: z.enum(['rectangle', 'ellipse']),
  width: z.number(),
  height: z.number(),
  backgroundColor: z.string(),
});

// Discriminated union of all node types
export const CanvasNodeSchema = z.discriminatedUnion('type', [
  StickyNoteSchema,
  ShapeSchema,
]);
