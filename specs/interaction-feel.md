# Interaction Feel

This spec defines the kinesthetic quality of interactions. Limb should feel like a precision instrument: responsive, smooth, and physically intuitive.

## S1 Zoom Momentum

### S1.1 Inertial Zoom

Scroll-to-zoom has momentum. When the user releases the scroll/pinch gesture, the zoom continues decelerating smoothly rather than stopping abruptly.

- **Friction coefficient:** Tunable. Default: the zoom velocity halves every 120ms.
- **Minimum velocity threshold:** Momentum stops when velocity drops below 0.001 zoom-units/ms.
- **Interruption:** Any new scroll/pinch input immediately cancels the active momentum and starts fresh from the new input velocity.

### S1.2 Velocity Tracking

Track the last 3 scroll events (within a 150ms window) to compute release velocity. Single isolated scroll ticks should NOT trigger momentum, only sustained gestures.

### S1.3 Zoom Easing

When zooming programmatically (e.g., clicking a node to focus it):

- Duration: 350ms
- Easing: `cubic-bezier(0.25, 0.1, 0.25, 1.0)` (ease-out with slight overshoot feel)
- The zoom target is the clicked node's center.

## S2 Pan Momentum

### S2.1 Inertial Pan

Click-and-drag panning (when zoomed out) also has momentum on release.

- Same friction model as zoom momentum (S1.1).
- Pan velocity is tracked as a 2D vector `{ vx, vy }`.
- Both axes decelerate independently.

### S2.2 Boundary Damping

When panning beyond the tree's bounding box, apply elastic resistance:

- Pan speed is reduced by 80% when the viewport center is outside the tree bounds.
- On release, the viewport snaps back to the nearest edge of the tree bounds with a spring animation (200ms, ease-out).
- The tree should never fully leave the viewport. At least 20% of the tree bounding box remains visible.

## S3 Node Hover

### S3.1 Hover Feedback

When the cursor hovers over a node in tree view (`zoomLevel < 0.9`):

- The node elevates slightly (2px translate-up or subtle shadow increase).
- The node's title text becomes fully opaque (from 70% to 100%).
- Transition: 100ms ease-out.

### S3.2 Focus Ring

The currently focused node has a subtle persistent highlight (a thin colored border or gentle glow) visible at all zoom levels. This is the user's "you are here" indicator.

## S4 Tree Layout Animation

### S4.1 Node Addition

When a new child node is created:

1. The parent's subtree shifts to make room (200ms, ease-in-out).
2. The new node fades in from 0% opacity at its final position (150ms, ease-out, starting 100ms after the shift begins).
3. The edge from parent to child draws in from parent to child (200ms, ease-out).

### S4.2 Node Removal

When a node is closed:

1. The node and its subtree fade out (150ms).
2. The edge to the parent fades simultaneously.
3. Remaining siblings shift to fill the gap (200ms, ease-in-out, starting after the fade completes).

### S4.3 Batch Changes

If multiple nodes are added/removed in the same frame (e.g., closing a subtree), all animations play concurrently. Total animation time should not exceed 400ms regardless of batch size.

## S5 Micro-interactions

### S5.1 Click-to-Focus

Clicking a node in tree view triggers a zoom animation to that node. During the animation:

- Other nodes smoothly scale down and translate away.
- The target node grows toward the center.
- The address bar fades in during the last 30% of the animation.
- Total duration: 350ms.

### S5.2 Zoom-Out Reveal

When zooming out from a focused node:

- Sibling nodes appear first (they're closest), then the parent, then more distant relatives.
- Nodes appear with a subtle scale-up (from 90% to 100%) as they enter the viewport.
- This creates a "revealing" sensation rather than everything appearing at once.

### S5.3 Scroll-to-Zoom Cursor Anchoring

When zooming with Ctrl+Scroll, the point under the cursor stays fixed on screen. The zoom expands/contracts around the cursor position, not the viewport center. This matches the behavior of maps (Google Maps, Figma) and feels natural.

## S6 Frame Budget

All animations must maintain 60fps. If a frame takes longer than 16ms, the system should:

1. Skip animation frames (jump to final state) rather than stutter.
2. Reduce LOD tier thresholds temporarily (show more screenshots, fewer live views).
3. Never block the main thread with layout computation.

## S7 Kinesthetic Quality

### S7.1 Transition Smoothness

All animated properties must use easing functions. Linear interpolation is only acceptable for opacity fades. All other animated properties (position, scale, color) use ease-out or the cubic-bezier curve specified in S1.3.

State transitions must never cause visual discontinuities:
- **Tab appearance**: cross-fade from screenshot to live content. No blank flash.
- **Zoom in/out**: all elements scale continuously. No element should appear or disappear without an opacity transition of at least 100ms.
- **Focus change**: the viewport smoothly tracks the new focused node. No jumping.
- **Address bar**: fades in/out smoothly during zoom transitions, never pops.

### S7.2 Input Responsiveness

- **Drag-to-pan**: focus point must update in the same frame as the mouse event.
- **Scroll-to-zoom**: the target zoom level updates immediately on input.
- **Click-to-focus**: the animation must begin within one frame of the click event.
- **Keyboard shortcuts**: must execute within one frame. No debouncing on keyboard input.

### S7.3 Canvas Rendering Quality

- Anti-aliasing is enabled for all canvas strokes and curves.
- Bezier curves for tree edges use smooth curvature (no angular joints).
- Font rendering uses appropriate sizing: text is always readable, never clipped.
- Node borders use consistent corner radius matching the contained tab.

### S7.4 Animation Coordination

When multiple animations run concurrently (e.g., zoom + focus + LOD transitions):
- All animations must use the same time source.
- Animations must not fight each other. If zoom is animating toward a target and the user starts a new zoom gesture, the new gesture takes priority immediately.
- Completed animations must clean up: no residual callbacks, no stale interpolation state.
