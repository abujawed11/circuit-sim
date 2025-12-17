````md
# Circuit Simulator Editor Upgrades
## Feature A: Drag Wire Points (Vertex Editing)
## Feature B: Junction Dots + Branching (Net / Node Model)

This document explains **what needs to be done** and **how to do it** for two editor upgrades in our digital logic circuit simulator.

Current stack assumptions:
- Vite + React + Tailwind
- Canvas-based editor
- Circuit model includes:
  - `components[]` with `pins[]`
  - `wires[]` with `{ id, fromPinId, toPinId, points?: [{x,y}...] }`
- Routing today supports user-created intermediate `points` (polyline).

---

# Summary: Recommended Implementation Order
1) **Feature A (Drag Wire Points)** first — minimal changes, no refactor.
2) **Feature B (Junctions + Branching)** next — requires a model refactor to “nets/nodes”, but unlocks real fan-out and wire joining.

If implementing both “properly” in one go, skip A on the current model and directly implement B with a node/segment model that supports vertex dragging natively.

---

# Feature A: Drag Wire Points (Grab a Vertex and Move It)

## Goal
Allow the user to:
- Click a wire vertex (one of the intermediate route points in `wire.points`)
- Drag it to a new position (snapped to grid)
- Optionally:
  - `Backspace` removes selected vertex
  - `Shift` constrains axis (horizontal/vertical)
  - Insert a new vertex by double-clicking on a wire segment
  - Dragging endpoints is NOT allowed (endpoints are pins)

This feature should **not** change the simulation model — only the rendering/geometry of wires.

## Data Model (stays the same)
Wire:
```js
{
  id: string,
  fromPinId: string,
  toPinId: string,
  points: Array<{x:number, y:number}> // intermediate vertices (optional empty)
}
````

Draft wire:

```js
draft = {
  fromPinId: string,
  points: Array<{x,y}>,
}
```

## UI State Needed

Add editor UI state in Canvas:

* `selectedWireId: string | null`
* `selectedVertex: { wireId: string, index: number } | null`
* `dragVertex: { wireId: string, index: number, startMouse:{x,y}, startPoint:{x,y} } | null`

Also keep:

* existing component dragging
* wire selection/deletion

## Hit Testing for Vertices

When user clicks:

1. If drafting → handle draft
2. Else:

   * Check pin hit
   * Check vertex hit (new)
   * Check wire segment hit (existing polyline hit)
   * Check component hit

Vertex hit test:

* For each wire, build polyline:

  * start pin pos + `points[]` + end pin pos
* But only vertices in `wire.points` are draggable.
* For each vertex `p` in `wire.points`:

  * If distance(mouse, p) <= `VERTEX_RADIUS`, it’s a hit.
* Prefer top-most / last wire in array.

## Dragging Behavior

On mouse down:

* If vertex hit → start vertex drag:

  * set `dragVertex = { wireId, index, startMouse, startPoint }`
  * set `selectedWireId = wireId` and `selectedVertex`
* Else proceed with existing selection logic.

On mouse move:

* If dragging vertex:

  * newPoint = startPoint + (mouse - startMouse)
  * snap to grid (e.g. 24 px)
  * If `Shift` pressed:

    * constrain to horizontal or vertical based on larger delta
  * Update wire’s `points[index] = newPoint`

On mouse up:

* clear `dragVertex`

## Ortho Constraint (Optional but recommended)

We currently build ortho segments by inserting intermediate points during route placement.
When dragging a vertex, the polyline might become “non-ortho” unless we enforce it.

Two approaches:

### A1) Soft constraint (simple)

* Allow any vertex movement, wire can be diagonal for that segment.
* Easy, but breaks Manhattan style.

### A2) Hard Manhattan constraint (recommended)

* Keep segments orthogonal by forcing dragged vertex to align with neighbors:

  * If vertex has prev and next points in polyline, enforce either:

    * `vertex.x = prev.x` OR `vertex.y = prev.y` for the segment from prev→vertex
    * and `vertex.x = next.x` OR `vertex.y = next.y` for vertex→next
* Practical approach:

  * While dragging, determine which axis to lock using Shift or nearest axis.
  * Update only one coordinate (x or y).
* For better results:

  * On drag end, run a “cleanup” that removes redundant points (collinear duplicates).

## Cleanup Utilities

Add helper:

* `normalizePoints(points, from, to)`:

  * removes duplicates
  * removes points that are collinear (prev, curr, next in same line)
  * clamps point count if needed

Insert new point:

* Double-click on a wire segment:

  * hit-test segment
  * insert vertex at nearest snapped location into `wire.points` at correct index

Delete selected vertex:

* Backspace removes that point from `wire.points`

## Required Parent Callback

Canvas must be able to mutate wires:

* Add `onUpdateWirePoints(wireId, newPoints)` prop to Canvas
* Parent updates circuit state immutably.

## Testing Checklist

* Dragging a vertex updates visuals in real time
* Selection highlight remains correct
* Delete wire still works
* Wire hit-testing still works after point edits
* Dragging a component moves endpoints but preserves intermediate wire points
* Backspace deletes vertex (only when vertex selected, not when drafting wire)
* No crashes when wire has 0 points

---

# Feature B: Junction Dots + Branching (Join Wires and Split Signals)

## Goal

Support real wiring behavior:

* One output can drive multiple inputs (fan-out)
* Wires can connect to other wires (T-junctions)
* Junction dots appear where branches meet
* Dragging a junction moves connected segments
* Proper signal propagation across the whole net

This requires changing the model away from “one wire = fromPin→toPin” into a **net graph**:

* **Nodes** (junction points)
* **Segments** between nodes
* Pins attach to nodes
* The net value is computed from drivers feeding a node.

## Why Refactor Is Needed

With the current `fromPinId -> toPinId` wires:

* Joining two wires is ambiguous (which one is the “from”?)
* Branching requires duplicating wires and keeping them consistent
* Signal evaluation becomes messy (multiple drivers, conflicts)
  A node-based model solves this cleanly.

## Proposed Data Model (Node + Segment Graph)

### Nodes

```js
node = {
  id: string,
  x: number,
  y: number,
  // optional metadata
}
```

### Segments (orthogonal polyline pieces)

Option 1 (simplest): segment is always straight:

```js
segment = {
  id: string,
  a: nodeId,
  b: nodeId,
}
```

Option 2 (polyline segment): segment includes intermediate points:

```js
segment = {
  id: string,
  a: nodeId,
  b: nodeId,
  points: Array<{x,y}> // usually empty if nodes handle junctions
}
```

### Pin Attachments

Instead of wiring pin-to-pin, pins attach to nodes:

```js
pinLink = {
  pinId: string,
  nodeId: string,
}
```

### Nets (Optional but useful)

We can compute nets as connected components of nodes+segments at runtime.
Or store:

```js
net = { id: string, nodeIds: string[] }
```

### Circuit Structure

```js
circuit = {
  components: [...],
  nodes: [...],
  segments: [...],
  pinLinks: [...],
}
```

## UI/UX Behavior

### Creating Wires with Points

Draft routing becomes:

1. Click output pin → create/start at a node located at that pin position (or reuse existing)
2. Move mouse → preview segment
3. Click empty canvas:

   * create a new node at snapped point
   * create a segment from last node to new node
4. Keep adding nodes/segments
5. Click on an input pin:

   * create/reuse node at that pin
   * connect last node to it with a segment
   * create `pinLink` from that input pin to the node

### Joining / Branching

* When the user clicks on an existing segment while drafting:

  * Insert a junction node onto the segment at nearest snapped point
  * Split the segment into two segments (a->junction, junction->b)
  * Connect draft to that junction node
* When clicking an existing node:

  * Continue from that node (no new node created)

### Junction Dot Rendering Rule

A junction dot appears when a node has degree >= 3:

* degree = number of connected segments + number of pinLinks (optional)
* Render a small filled circle at that node

## Hit Testing Needed

* Node hit test (for selecting junction points)
* Segment hit test (distance point to segment)
* Pin hit test (existing)

## Editing

### Drag nodes (junctions)

* Click node → drag
* All connected segments update automatically (since endpoints are nodes)

### Delete segment or node

* Deleting a segment removes it
* Deleting a node removes connected segments and pinLinks
* Must merge / cleanup dangling nodes (degree 0) after deletes

### Insert node on segment

* Double click segment → insert node + split segment

## Simulation Changes (Critical)

We need to compute signal values on nets.

### Approach

1. Determine nets (connected components) of node graph.
2. For each net:

   * Determine driver sources (outputs connected via pinLinks)
   * If 0 drivers → net = X
   * If 1 driver → net = that value
   * If multiple drivers:

     * If all same → ok
     * If conflict (0 and 1) → X (or "CONFLICT")
3. For each input pin:

   * its value = net value at the node it’s linked to
4. Evaluate components:

   * compute outputs
   * update driver values
5. Iterate until stable (as currently)

### Data Flow

* Need mapping: `pinId -> nodeId -> netId`
* Need mapping: `netId -> currentValue`

### Multiple Driver Policy

For digital logic v1:

* Conflicts become `LV.X` and optionally show UI highlight

## Migration Plan from Current Model

If you already have saved circuits with `wires[]`:

* Convert each wire into:

  * node at fromPin position
  * node at toPin position
  * nodes for each intermediate point
  * segments between consecutive nodes
  * pinLinks for endpoints pins to endpoint nodes
* Deduplicate nodes that overlap (same x,y within tolerance)

## Testing Checklist

* Branch from output to 2+ inputs works
* Joining wires mid-segment creates junction and propagates value
* Junction dots appear only where appropriate
* Dragging a junction moves all attached wires
* Deleting a segment updates nets and UI correctly
* Conflicting drivers set net to X
* Performance acceptable for medium circuits

---

# Implementation Guidance / Scope Control

## If you want fastest “good enough” branching

Implement Feature B with:

* Nodes + straight segments only (no segment.points)
* Force Manhattan routing by creating nodes at every bend
* This makes editing easy and robust.

## If you want vertex dragging + branching seamlessly

Once nodes exist:

* Vertex dragging is effectively “dragging a node”
* New vertices are “insert node on segment”
  So Feature A naturally becomes part of Feature B.

---

# Deliverables for the Agent

## Deliverable A (Wire vertex dragging on current model)

* Add `onUpdateWirePoints(wireId, points)` prop + state updates
* Add vertex hit-test + drag logic
* Add backspace delete vertex
* Add optional insert vertex (dbl click segment)
* Add cleanup normalization

## Deliverable B (Junctions + branching with node/segment model)

* Add `nodes[]`, `segments[]`, `pinLinks[]` to circuit
* Update editor interactions to create nodes/segments
* Add join-to-segment (insert node + split)
* Render junction dots
* Update simulation engine to evaluate nets

---

# Suggested Next Step

If you want minimal disruption now:

* Implement **Deliverable A** first.

If your next milestone is “real circuit editor feel”:

* Implement **Deliverable B** (nodes/segments) and treat vertex dragging as “node drag”.

