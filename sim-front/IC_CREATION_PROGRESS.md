# IC Creation - Implementation Progress

**Last Updated:** 2025-12-18
**Status:** 🟡 In Progress (Foundation Complete, Core Features Pending)

---

## 📋 Overview

This document tracks the implementation of **hierarchical IC creation** - allowing users to select components/wires and convert them into reusable ICs (like creating a Half Adder and using it to build a Full Adder).

---

## ✅ What Has Been Done

### 1. **Data Structures** (COMPLETE)

**File:** `src/sim/model/types.js`

```javascript
// Added IC storage to circuit
makeEmptyCircuit() {
  components: [],
  wires: [],
  icDefinitions: []  // ✅ NEW: Stores custom ICs
}

// IC Definition structure
makeICDefinition(name, inputPins, outputPins, internalCircuit) {
  id: uid(),
  name: "HALF_ADDER",
  inputPins: [{ name: "A", order: 0 }, { name: "B", order: 1 }],
  outputPins: [{ name: "SUM", order: 0 }, { name: "CARRY", order: 1 }],
  internalComponents: [...],  // Saved sub-circuit
  internalWires: [...],
  createdAt: Date.now()
}
```

**Status:** ✅ Complete

---

### 2. **Persistence Layer** (COMPLETE)

**File:** `src/sim/ui/Editor.jsx`

- ✅ **localStorage Integration**: Auto-saves circuit on every change
- ✅ **Auto-load**: Restores circuit on page refresh
- ✅ **Export/Import**: Download/upload circuits as JSON files
- ✅ IC definitions included in saved circuit (when created)

**Status:** ✅ Complete

---

### 3. **UI Button** (COMPLETE)

**File:** `src/sim/ui/Editor.jsx` (line 658-663)

```jsx
<button onClick={() => setIcCreationDialog({ open: true })}>
  ⚡ Create IC from Selection
</button>
```

**Location:** Palette footer (bright yellow button)

**Status:** ✅ Complete (button exists but not functional yet)

---

## 🚧 What Needs to Be Done

### **PHASE 1: Selection & Dialog** (NEXT STEP)

#### Task 1.1: Pass Selection State to Editor (⏱️ ~1 hour)

**Problem:**
Canvas tracks `selectedCompIds` and `selectedWireIds` internally. Editor can't see what's selected.

**Solution:**
Add callback to Canvas to expose selection state upward.

**Files to Modify:**
- `src/sim/ui/Canvas.jsx` - Add `onSelectionChange` prop
- `src/sim/ui/Editor.jsx` - Track selection state

**Code Changes:**
```jsx
// Canvas.jsx - Add callback
useEffect(() => {
  if (onSelectionChange) {
    onSelectionChange(selectedCompIds, selectedWireIds);
  }
}, [selectedCompIds, selectedWireIds]);

// Editor.jsx - Track selection
const [currentSelection, setCurrentSelection] = useState({ compIds: [], wireIds: [] });
```

**Acceptance Criteria:**
- ✅ Editor knows which components/wires are selected
- ✅ Button shows count: "Create IC (5 items selected)"

---

#### Task 1.2: Create IC Creation Dialog (⏱️ ~2-3 hours)

**Requirements:**
Modal dialog with:
1. **IC Name Input**
2. **Auto-detected Interface Pins** (connected to outside selection)
3. **Pin Configuration**:
   - Rename pins
   - Reorder pins
   - Mark as input/output
4. **Validation**:
   - Name not empty
   - No duplicate pin names
   - At least 1 input and 1 output
5. **Preview** (optional): Show simplified IC block

**UI Mockup:**
```
┌─────────────────────────────────────┐
│   Create New IC                     │
├─────────────────────────────────────┤
│ IC Name: [HALF_ADDER        ]      │
│                                     │
│ ■ Input Pins (2 detected)          │
│   • A  (from AND gate pin 1)       │
│   • B  (from XOR gate pin 1)       │
│                                     │
│ ■ Output Pins (2 detected)         │
│   • SUM   (from XOR gate output)   │
│   • CARRY (from AND gate output)   │
│                                     │
│        [Cancel]  [Create IC]       │
└─────────────────────────────────────┘
```

**Files to Create:**
- `src/sim/ui/ICCreationDialog.jsx` (new component)

**Status:** ⏸️ Not Started

---

### **PHASE 2: Interface Detection** (⏱️ ~2 hours)

#### Task 2.1: Detect Interface Pins

**Problem:**
Need to identify which pins of selected components connect to the "outside world" (non-selected components).

**Algorithm:**
```javascript
function detectInterfacePins(selectedCompIds, selectedWireIds, circuit) {
  const interfacePins = [];

  // Find all wires connected to selection
  circuit.wires.forEach(wire => {
    const fromComp = findComponentByPinId(wire.fromPinId);
    const toComp = findComponentByPinId(wire.toPinId);

    const fromSelected = selectedCompIds.includes(fromComp.id);
    const toSelected = selectedCompIds.includes(toComp.id);

    // Interface pin = crosses selection boundary
    if (fromSelected && !toSelected) {
      interfacePins.push({ pinId: wire.fromPinId, direction: 'output' });
    }
    if (!fromSelected && toSelected) {
      interfacePins.push({ pinId: wire.toPinId, direction: 'input' });
    }
  });

  return interfacePins;
}
```

**Validation:**
- ❌ Internal wires (both ends selected) → IGNORED
- ✅ Boundary wires (one end selected) → INTERFACE PIN
- ❌ Floating pins (not connected) → WARNING (optional)

**Status:** ⏸️ Not Started

---

### **PHASE 3: IC Storage** (⏱️ ~1 hour)

#### Task 3.1: Save IC Definition

**Implementation:**
```javascript
const createIC = (name, inputPins, outputPins, selectedCompIds, selectedWireIds) => {
  // Extract sub-circuit
  const internalComponents = circuit.components.filter(c =>
    selectedCompIds.includes(c.id)
  );
  const internalWires = circuit.wires.filter(w =>
    selectedWireIds.includes(w.id) ||
    (isInternalWire(w, selectedCompIds))
  );

  // Make coordinates relative (center at 0,0)
  const normalizedComponents = normalizePositions(internalComponents);

  // Create IC definition
  const icDef = makeICDefinition(name, inputPins, outputPins, {
    components: normalizedComponents,
    wires: internalWires
  });

  // Save to circuit
  const next = structuredClone(circuit);
  next.icDefinitions.push(icDef);
  updateCircuit(next);
};
```

**Status:** ⏸️ Not Started

---

### **PHASE 4: Dynamic Palette** (⏱️ ~1 hour)

#### Task 4.1: Add ICs to Palette

**Goal:** Show created ICs in palette like regular components.

**Implementation:**
```jsx
const groupedPalette = useMemo(() => {
  const groups = [
    { title: "I/O", items: [...] },
    { title: "Gates", items: [...] },
    { title: "Sequential", items: [...] },

    // ✅ NEW: Custom ICs Group
    ...(circuit.icDefinitions.length > 0 ? [{
      title: "Custom ICs",
      items: circuit.icDefinitions.map(ic => ({
        kind: `IC_${ic.id}`,  // Dynamic KIND
        label: ic.name,
        short: "IC",
        hint: `${ic.inputPins.length}→${ic.outputPins.length}`,
        isCustomIC: true,
        icDefId: ic.id
      }))
    }] : [])
  ];

  return groups;
}, [circuit.icDefinitions]);
```

**Status:** ⏸️ Not Started

---

### **PHASE 5: IC Component Creation** (⏱️ ~2 hours)

#### Task 5.1: Create IC Component Instances

**Goal:** When user places an IC from palette, create a component that references the IC definition.

**Data Structure:**
```javascript
// IC instance (placed on canvas)
{
  id: "comp_abc123",
  kind: "IC_CUSTOM",
  icDefinitionId: "ic_xyz789",  // Reference to IC definition
  x: 100,
  y: 200,
  w: 120,
  h: 100,
  pins: [
    { id: "pin_1", name: "A", dir: "in", value: LV.X },   // External pin
    { id: "pin_2", name: "B", dir: "in", value: LV.X },
    { id: "pin_3", name: "SUM", dir: "out", value: LV.X },
    { id: "pin_4", name: "CARRY", dir: "out", value: LV.X }
  ],
  state: {
    internalCircuit: null  // Will be instantiated during simulation
  }
}
```

**Files to Modify:**
- `src/sim/model/gates.js` - Add IC_CUSTOM case
- `src/sim/model/types.js` - Add IC kind

**Status:** ⏸️ Not Started

---

### **PHASE 6: IC Rendering** (⏱️ ~1 hour)

#### Task 6.1: Draw IC Blocks

**Goal:** Render ICs as chip blocks (not like regular gates).

**Visual Design:**
```
┌─────────────────┐
│  HALF_ADDER     │  ← IC name
├─────────────────┤
│A ●           ● S│  ← Pins on edges
│B ●           ● C│
└─────────────────┘
```

**Implementation:**
```javascript
// Canvas.jsx - in draw loop
if (c.kind === "IC_CUSTOM") {
  const icDef = circuit.icDefinitions.find(ic => ic.id === c.icDefinitionId);

  // Draw chip body
  ctx.fillStyle = "#1a1a2e";
  roundRect(ctx, c.x, c.y, c.w, c.h, 8);
  ctx.fill();
  ctx.stroke();

  // Draw IC name
  ctx.fillStyle = "#e5e5e5";
  ctx.font = "bold 14px monospace";
  ctx.fillText(icDef.name, c.x + 10, c.y + 20);

  // Draw pins with labels
  c.pins.forEach((p, i) => {
    const pos = pinPosition(c, p);
    pinDot(ctx, pos.x, pos.y, p.value);

    // Pin label
    ctx.fillStyle = "#aaa";
    ctx.font = "10px monospace";
    ctx.fillText(p.name, pos.x + 10, pos.y + 4);
  });
}
```

**Status:** ⏸️ Not Started

---

### **PHASE 7: IC Simulation** (⏱️ ~3 hours) ⚠️ COMPLEX

#### Task 7.1: Simulate IC Internals

**Goal:** When simulating, run the internal circuit for each IC instance.

**Challenge:** Need to map external pins → internal circuit → external pins.

**Algorithm:**
```javascript
// In simulate.js
if (c.kind === "IC_CUSTOM") {
  const icDef = circuit.icDefinitions.find(ic => ic.id === c.icDefinitionId);

  // 1. Create internal circuit instance (clone from definition)
  const internalCircuit = {
    components: structuredClone(icDef.internalComponents),
    wires: structuredClone(icDef.internalWires)
  };

  // 2. Map external input pins → internal circuit
  icDef.inputPins.forEach(inputDef => {
    const externalPin = c.pins.find(p => p.name === inputDef.name);
    const internalPin = findInternalInputPin(internalCircuit, inputDef);

    // Drive internal pin with external value
    internalPin.value = externalPin.value;
  });

  // 3. Simulate internal circuit
  simulate(internalCircuit);

  // 4. Map internal outputs → external output pins
  icDef.outputPins.forEach(outputDef => {
    const externalPin = c.pins.find(p => p.name === outputDef.name);
    const internalPin = findInternalOutputPin(internalCircuit, outputDef);

    // Read internal value to external pin
    if (externalPin.value !== internalPin.value) {
      externalPin.value = internalPin.value;
      changed = true;
    }
  });
}
```

**Edge Cases:**
- ⚠️ Recursive ICs (IC containing another IC) - need depth limit
- ⚠️ Performance (many ICs = many simulations)
- ⚠️ Pin mapping errors

**Status:** ⏸️ Not Started

---

## 📊 Implementation Summary

| Phase | Task | Status | Estimated Time | Complexity |
|-------|------|--------|----------------|------------|
| **Foundation** | Data structures | ✅ Complete | - | Low |
| **Foundation** | Persistence | ✅ Complete | - | Low |
| **Foundation** | UI Button | ✅ Complete | - | Low |
| **Phase 1** | Selection state | ⏸️ Not Started | 1 hour | Low |
| **Phase 1** | IC dialog | ⏸️ Not Started | 2-3 hours | Medium |
| **Phase 2** | Interface detection | ⏸️ Not Started | 2 hours | Medium |
| **Phase 3** | IC storage | ⏸️ Not Started | 1 hour | Low |
| **Phase 4** | Dynamic palette | ⏸️ Not Started | 1 hour | Low |
| **Phase 5** | IC instances | ⏸️ Not Started | 2 hours | Medium |
| **Phase 6** | IC rendering | ⏸️ Not Started | 1 hour | Low |
| **Phase 7** | IC simulation | ⏸️ Not Started | 3 hours | **High** |

**Total Estimated Time:** ~13-15 hours of development

---

## 🎯 Next Immediate Steps

**Priority Order:**

1. **✅ Task 1.1** - Pass selection state (30 min - 1 hour)
2. **✅ Task 2.1** - Detect interface pins (1-2 hours)
3. **✅ Task 1.2** - Create dialog (2-3 hours)
4. **✅ Task 3.1** - Save IC definition (1 hour)

**First Milestone:** User can create IC, see it saved (but not use it yet)

---

## 🚨 Known Challenges

### 1. **Pin Mapping** (Phase 7)
- Need robust way to identify which internal pins correspond to interface
- Solution: Store pinId mappings in IC definition

### 2. **Coordinate Normalization**
- Selected components have absolute positions
- Need to make relative for reusable IC
- Solution: Find bounding box, subtract minimum x/y

### 3. **Recursive ICs**
- IC containing another IC containing another IC...
- Solution: Max depth limit (e.g., 5 levels)

### 4. **Performance**
- Many ICs = many nested simulations
- Solution: Cache results, optimize later

---

## 📝 Testing Plan

### Manual Test Cases

**Test 1: Simple Half Adder**
1. Create XOR gate + AND gate
2. Wire inputs together
3. Select both gates + wires
4. Create IC named "HALF_ADDER"
5. Verify IC appears in palette
6. Place IC on canvas
7. Connect inputs (HIGH + HIGH)
8. Verify output (SUM=LOW, CARRY=HIGH)

**Test 2: Nested IC (Full Adder from Half Adders)**
1. Create 2 HALF_ADDER ICs + 1 OR gate
2. Wire them together
3. Create IC named "FULL_ADDER"
4. Test all 8 input combinations

**Test 3: Persistence**
1. Create IC
2. Refresh page
3. Verify IC still in palette
4. Export circuit
5. Clear canvas
6. Import circuit
7. Verify IC definition restored

---

## 🔧 Development Tools

**Debugging:**
```javascript
// Add to Editor.jsx for debugging
window.debugCircuit = () => {
  console.log("Circuit:", circuit);
  console.log("IC Definitions:", circuit.icDefinitions);
};

// Usage in browser console:
debugCircuit();
```

**Logging:**
```javascript
// In simulate.js for IC debugging
if (c.kind === "IC_CUSTOM") {
  console.log(`[IC ${c.id}] Simulating ${icDef.name}`);
  console.log("Inputs:", c.pins.filter(p => p.dir === "in"));
  console.log("Outputs:", c.pins.filter(p => p.dir === "out"));
}
```

---

## 📚 References

- **IC_CREATION_PLAN.md** - Original requirements
- **types.js** - Data structures
- **Editor.jsx** - Main UI component
- **simulate.js** - Simulation engine

---

## ✨ Future Enhancements (Post-MVP)

- 🔄 Edit existing ICs (double-click to open internal view)
- 📦 IC library export/import (share ICs separately)
- 🎨 Custom IC appearance (colors, icons)
- 📊 IC analytics (usage count, performance)
- 🌐 Cloud IC library (public repository)
- 🔍 IC search/filter
- 🏷️ IC categories/tags
- 📝 IC documentation (description, usage notes)

---

**Status Legend:**
- ✅ Complete
- 🚧 In Progress
- ⏸️ Not Started
- ⚠️ Blocked/Issues
- 🔥 Critical
