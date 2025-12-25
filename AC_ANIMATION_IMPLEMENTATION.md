# AC Circuit Animation Implementation Plan

## Project Overview

This document outlines the implementation of **EveryCircuit-style AC circuit simulation** with real-time current flow animation for the circuit simulator application.

**Goal**: Provide visual, animated current flow similar to EveryCircuit app, where users can see particles flowing through wires with sinusoidal motion for AC circuits.

---

## 🎯 Current Status: Phase 1 Complete

### ✅ Completed Features (Phase 1: Core Animation System)

#### 1. **Particle System Architecture**
**File**: `sim-front/src/sim/ui/ParticleSystem.js`

- [x] `Particle` class for individual particle state
  - Position tracking (0-1 along wire path)
  - Velocity with sinusoidal oscillation for AC
  - Random phase offsets for visual variety
  - Path interpolation for smooth movement along polylines

- [x] `ParticleSystem` class for managing all particles
  - Wire-based particle configuration
  - Automatic particle count scaling based on current magnitude
  - Logarithmic scaling: 1µA → 2 particles, 1mA → 5, 1A → 8, 10A → 12
  - AC/DC detection and handling
  - Frequency-aware animation for AC circuits
  - Render method with glowing visual effects

**Features**:
- Particles flow along wire paths (polylines with bend points)
- **AC Mode**: Particles oscillate sinusoidally (velocity = baseVelocity × sin(ωt + φ))
- **DC Mode**: Particles move at constant velocity
- Current magnitude → particle density (more current = more particles)
- Current direction → particle flow direction
- Glowing visual effects (blue for AC, yellow/gold for DC)

#### 2. **Canvas Integration**
**File**: `sim-front/src/sim/ui/Canvas.jsx`

- [x] Import and initialize `ParticleSystem`
- [x] Update particle system on simulation data changes
- [x] Extract AC frequency from VAC component values
  - Parses `SIN(offset amp freq)` format
  - Supports engineering notation (1k, 1M, 1u, etc.)
  - Falls back to 1kHz default
- [x] Build wire path maps for particle rendering
- [x] Render particles every frame (60 FPS)
- [x] Animation loop with delta time for smooth motion
- [x] Respect animation enabled/speed settings

**Key Implementation Details**:
```javascript
// Frequency extraction from VAC:
// "SIN(0 5 1k)" → 1000 Hz
const sinMatch = value.match(/SIN\([^)]*\s+([\d.]+[kKmMuUnNpP]?)\)/i);

// Particle configuration per wire:
particleSystem.setWireConfig(wireId, current, isAC, frequency);

// Rendering:
particleSystem.render(ctx, wirePaths);
```

#### 3. **Animation Controls UI**
**File**: `sim-front/src/sim/ui/Editor.jsx`

- [x] State management for animation settings
  - `animationEnabled` (boolean, default: true)
  - `animationSpeed` (float, range: 0.1x - 3.0x, default: 1.0x)

- [x] UI controls in left panel sidebar
  - **ON/OFF toggle button** with visual feedback (green when on)
  - **Speed slider** with live value display
  - Disabled state when animation is off
  - Styled to match existing UI theme

- [x] Props passed to Canvas component
  - `animationEnabled`
  - `animationSpeed`

**UI Layout**:
```
┌─────────────────────────┐
│ Analog Analysis         │
│ ├─ Analysis Type        │
│ ├─ Parameters           │
│ └─ [Run Analog]         │
│                         │
│ CURRENT ANIMATION       │
│ ├─ [ON/OFF Toggle]      │
│ └─ Speed: 1.0x ━━━━○━━  │
└─────────────────────────┘
```

#### 4. **Build & Integration**
- [x] No build errors
- [x] Proper imports and dependencies
- [x] React hooks properly configured
- [x] Animation loop optimized (requestAnimationFrame)
- [x] Memory management (cleanup on unmount)

---

## 🚧 Remaining Features (Phase 2-4)

### Phase 2: Enhanced Transient Simulation

**Goal**: Provide continuous real-time animation for AC circuits (like EveryCircuit's live mode)

#### 2.1 Real-Time Transient Loop
**Status**: ❌ Not Started

**Current Limitation**:
- Simulation runs once when user clicks "Run Analog"
- Shows final state or static waveform plot
- Particles animate based on static current values

**Needed**:
- [ ] Continuous transient simulation loop
  - Run transient with small time windows (e.g., 5-10 AC cycles)
  - Update at ~30 FPS (not 60 FPS to save CPU)
  - Stream time-series data to animation system

- [ ] Time-stepped current updates
  - Extract current values for each time step
  - Interpolate between steps for smooth 60 FPS animation
  - Synchronize particle phase with simulation time

- [ ] Playback controls
  - [ ] Play/Pause button
  - [ ] Restart button
  - [ ] Time scrubber (seek to any point in waveform)
  - [ ] Loop mode toggle

**Files to Modify**:
- `sim-front/src/sim/ui/Editor.jsx` - Add time-stepping logic
- `sim-front/src/sim/analog/api/simulateAnalog.js` - Support streaming mode
- `sim-back/app/services/ngspice_runner.py` - Return time-series data

**Implementation Approach**:
```javascript
// Pseudocode
const [animationTime, setAnimationTime] = useState(0);
const [tranData, setTranData] = useState(null); // { time: [...], series: [...] }

useEffect(() => {
  if (!isPlaying) return;

  const loop = () => {
    setAnimationTime(t => {
      const nextTime = t + dt;

      // Get current values at this time
      const currents = interpolateCurrents(tranData, nextTime);

      // Update particle system
      updateParticlesWithCurrents(currents);

      // Loop back to start
      if (nextTime > tranData.stopTime) return 0;
      return nextTime;
    });
  };

  const id = requestAnimationFrame(loop);
  return () => cancelAnimationFrame(id);
}, [isPlaying, tranData]);
```

#### 2.2 Accurate AC Particle Motion
**Status**: ❌ Not Started

**Current Limitation**:
- Particles use generic sinusoidal motion
- Not synchronized with actual voltage/current waveforms
- Phase relationships not accurate

**Needed**:
- [ ] Extract phase information from transient data
  - Parse voltage/current at each time step
  - Calculate instantaneous values
  - Determine flow direction based on sign

- [ ] Synchronize particle velocity with waveform
  - Velocity ∝ instantaneous current
  - Direction based on current sign
  - Speed varies smoothly over time

- [ ] Multi-frequency support
  - Handle circuits with multiple AC sources
  - Superposition of multiple frequencies
  - Beat patterns for non-harmonic sources

**Technical Details**:
```javascript
// Current implementation (generic):
velocity = baseVelocity * sin(2π * frequency * time + phase)

// Needed (accurate):
velocity = k * current(t)  // where current(t) comes from transient data
direction = sign(current(t))
```

---

### Phase 3: Interactive Waveform Viewing

**Goal**: Click any component/wire to see live oscilloscope-style waveform

#### 3.1 Click-to-View Waveform Popup
**Status**: ❌ Not Started

**Features Needed**:
- [ ] Click detection on wires and components
  - Add onClick handlers to wire rendering
  - Add onClick handlers to component rendering
  - Identify which signal to display (voltage or current)

- [ ] Mini oscilloscope component
  - [ ] Draggable modal/popup window
  - [ ] Real-time sweeping display (like oscilloscope)
  - [ ] X-axis: time, Y-axis: voltage or current
  - [ ] Auto-scaling or manual V/div, time/div controls
  - [ ] Pin/unpin to keep multiple scopes open

- [ ] Multi-channel support
  - [ ] Display multiple signals on one scope
  - [ ] Color-coded traces
  - [ ] Legend showing signal names

**UI Mockup**:
```
┌────────────────────────────┐
│ Scope: v(n1)          [×]  │ ← Draggable, closeable
├────────────────────────────┤
│     ^                      │
│  5V │   ╱╲      ╱╲         │
│     │  ╱  ╲    ╱  ╲        │
│  0V │─╱────╲──╱────╲─────→ │
│     │       ╲╱      ╲╱     │
│     └───────────────────   │
│     0ms  2ms  4ms  6ms     │
├────────────────────────────┤
│ V/div: [5V▼] Time: [2ms▼] │
│ [📌 Pin]  [CH2: Add...]    │
└────────────────────────────┘
```

**Files to Create**:
- `sim-front/src/sim/ui/OscilloscopeModal.jsx`
- `sim-front/src/sim/ui/WaveformDisplay.jsx` (chart component)

**Files to Modify**:
- `sim-front/src/sim/ui/Canvas.jsx` - Add click handlers
- `sim-front/src/sim/ui/Editor.jsx` - Manage scope windows

#### 3.2 Live Waveform Animation
**Status**: ❌ Not Started

**Features**:
- [ ] Sweeping display (like real oscilloscope)
  - Traces draw from left to right
  - Old data scrolls off screen
  - Continuous update during simulation

- [ ] Trigger controls
  - [ ] Auto, Normal, Single trigger modes
  - [ ] Trigger level adjustment
  - [ ] Rising/falling edge selection

- [ ] Measurements
  - [ ] RMS value
  - [ ] Peak-to-peak amplitude
  - [ ] Frequency measurement
  - [ ] Phase angle (relative to reference)

---

### Phase 4: Advanced Visualization

**Goal**: Phase relationships, phasor diagrams, and enhanced visual feedback

#### 4.1 Phase Visualization
**Status**: ❌ Not Started

**Features**:
- [ ] Color-code wires by phase
  - Extract phase from AC analysis
  - Map phase angle to color (HSL color space)
  - 0° = red, 90° = green, 180° = cyan, 270° = blue

- [ ] Phase angle indicators on components
  - Show phase angle next to AC sources
  - Animated rotating phasor icon

- [ ] Phase difference highlighting
  - Show lag/lead relationships visually
  - Annotate phase shift across components (e.g., capacitors)

#### 4.2 Phasor Diagram Overlay
**Status**: ❌ Not Started

**Features**:
- [ ] Draggable phasor diagram window
  - Complex plane (Re/Im axes)
  - Rotating phasors for each voltage/current
  - Length = magnitude, angle = phase

- [ ] Animation
  - Phasors rotate at AC frequency
  - Update in real-time with simulation

- [ ] Interactive selection
  - Click nodes/components to add phasors
  - Color-coded for each signal

**UI Mockup**:
```
        Im
         ↑
         │  V₁ →
         │   ╱
─────────┼──────→ Re
         │╱ V₂
         │
```

#### 4.3 Current Density Visualization
**Status**: ❌ Not Started

**Enhancement of existing particle system**:
- [ ] Wire thickness based on current magnitude
  - Thicker wires = higher current
  - Dynamic scaling during animation

- [ ] Heat map overlay
  - Color components by power dissipation
  - Red = high power, blue = low power

- [ ] Vector field visualization (advanced)
  - Show current direction with arrows
  - Arrow size = magnitude

---

## 📋 Full Feature Comparison: Current vs EveryCircuit

| Feature | EveryCircuit | Our Simulator | Status |
|---------|-------------|---------------|--------|
| **Visual Current Flow** | ✅ Particle dots | ✅ Particle dots with glow | ✅ Done |
| **AC Oscillation** | ✅ Sinusoidal motion | ✅ Sinusoidal motion | ✅ Done |
| **Current Magnitude** | ✅ Dot density | ✅ Dot density (logarithmic) | ✅ Done |
| **Animation Controls** | ✅ Play/Pause | ✅ ON/OFF + Speed | ✅ Done |
| **AC Frequency Detection** | ✅ Auto | ✅ Auto (from VAC) | ✅ Done |
| **Real-Time Simulation** | ✅ Continuous loop | ❌ Single run | ⏳ Phase 2 |
| **Time Scrubber** | ✅ Seek in time | ❌ Not available | ⏳ Phase 2 |
| **Accurate Phase Sync** | ✅ Waveform-synced | ⚠️ Generic sine | ⏳ Phase 2 |
| **Click Component → Waveform** | ✅ Instant popup | ❌ Not implemented | ⏳ Phase 3 |
| **Live Oscilloscope** | ✅ Sweeping display | ❌ Not implemented | ⏳ Phase 3 |
| **Multiple Scopes** | ✅ Pin multiple | ❌ Not implemented | ⏳ Phase 3 |
| **Phase Visualization** | ✅ Color-coded | ❌ Not implemented | ⏳ Phase 4 |
| **Phasor Diagrams** | ✅ Available | ❌ Not implemented | ⏳ Phase 4 |
| **Component Values on Hover** | ✅ Tooltips | ⚠️ Partial | 🔄 Improve |
| **Voltage Labels on Nodes** | ✅ Live values | ⚠️ In results panel | 🔄 Improve |

**Legend**:
- ✅ Fully implemented
- ⚠️ Partially implemented
- ❌ Not implemented
- ⏳ Planned for future phase
- 🔄 Needs improvement

---

## 🏗️ Technical Architecture

### Current System Flow

```
┌─────────────────────────────────────────────────────────────┐
│                        USER ACTION                          │
│        (Place VAC, R, GND → Wire → Click "Run")            │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│                    Editor.jsx                                │
│  • handleToggleSimulation()                                 │
│  • Calls simulateAnalog() with circuit + analysis config    │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│           simulateAnalog() (Frontend API)                    │
│  • Builds netlist via toSpiceNetlist()                      │
│  • Sends POST to backend /api/analog/simulate               │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│          ngspice_runner.py (Backend)                        │
│  • Runs ngspice with .tran command                          │
│  • Exports wrdata CSV (voltages + currents vs time)         │
│  • Returns JSON: { ok, analysis, tran: { x, series } }      │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│              Editor.jsx (Response Handler)                   │
│  • Extracts currentMap, nodeVoltageMap                      │
│  • Sets simulationData state                                │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│                   Canvas.jsx                                 │
│  • useEffect watches simulationData changes                 │
│  • Calls getWireFlow() for each wire                        │
│  • Extracts current magnitude & direction                   │
│  • Calls particleSystem.setWireConfig()                     │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│               ParticleSystem.js                              │
│  • Creates/updates particles for each wire                  │
│  • Particle.update() runs at 60 FPS (requestAnimationFrame) │
│  • Calculates position along wire path                      │
│  • Renders glowing dots on canvas                           │
└─────────────────────────────────────────────────────────────┘
                 │
                 ▼
             [ANIMATION DISPLAYED TO USER]
```

### Key Data Structures

#### Circuit State (Editor)
```javascript
{
  components: [
    { id, kind: "A_VAC", props: { value: "SIN(0 5 1k)" }, pins: [...] },
    { id, kind: "A_R", props: { value: "1k" }, pins: [...] },
    ...
  ],
  wires: [
    { id, fromPinId, toPinId, points: [{x, y}, ...] },
    ...
  ],
  analogAnalysis: {
    type: "tran",
    tran: { step: "1u", stop: "10m" }
  }
}
```

#### Simulation Results
```javascript
{
  ok: true,
  analysis: "tran",
  tran: {
    x: [0, 1e-6, 2e-6, ...],           // Time points
    series: [
      { name: "v(n1)", y: [0, 5, 10, ...] },
      { name: "i(v1)", y: [0, 0.005, 0.01, ...] },
      ...
    ]
  },
  nodes: {
    pinToNode: { pinId1: "n1", pinId2: "0", ... },
    nets: [...]
  }
}
```

#### Particle System State
```javascript
// Per wire configuration
wireConfigs: Map {
  wireId1 => {
    current: 0.005,      // Amperes
    isAC: true,          // AC or DC
    frequency: 1000,     // Hz
    particleCount: 5,    // Number of particles
    baseVelocity: 0.008  // pixels per frame
  }
}

// Particles
particles: Map {
  wireId1 => [
    Particle { position: 0.3, velocity: 0.008, phase: 1.2, wireId: wireId1 },
    Particle { position: 0.7, velocity: 0.008, phase: 2.8, wireId: wireId1 },
    ...
  ]
}
```

---

## 🛠️ Implementation Roadmap

### Phase 1: ✅ COMPLETED (Current State)
**Timeline**: Completed in initial implementation
**Effort**: ~4-6 hours

- [x] Create ParticleSystem.js
- [x] Integrate into Canvas.jsx
- [x] Add animation controls to Editor.jsx
- [x] Parse VAC frequency
- [x] Test and debug

### Phase 2: Real-Time Simulation (Next Priority)
**Timeline**: 1-2 weeks
**Effort**: ~20-30 hours

**Week 1**: Core time-stepping
- [ ] Refactor simulation to return full time-series data
- [ ] Implement animation playback state machine
- [ ] Add time interpolation for smooth 60 FPS
- [ ] Create playback controls UI

**Week 2**: Accurate particle sync
- [ ] Synchronize particles with transient waveforms
- [ ] Handle multi-frequency circuits
- [ ] Performance optimization for continuous loop
- [ ] Testing with various AC frequencies

**Deliverables**:
- Continuous animation loop
- Play/Pause/Restart controls
- Time scrubber
- Accurate phase-synchronized particles

### Phase 3: Interactive Waveforms (Medium Priority)
**Timeline**: 2-3 weeks
**Effort**: ~30-40 hours

**Week 1**: Click detection & basic scope
- [ ] Add click handlers to Canvas
- [ ] Create OscilloscopeModal component
- [ ] Basic waveform rendering with Chart.js or uPlot
- [ ] Draggable window functionality

**Week 2**: Advanced scope features
- [ ] Sweeping display animation
- [ ] Multiple channels (CH1, CH2, etc.)
- [ ] Pin/unpin functionality
- [ ] Auto-scaling and manual controls

**Week 3**: Measurements & polish
- [ ] RMS, peak-to-peak calculations
- [ ] Trigger controls
- [ ] Frequency measurement
- [ ] UI/UX refinement

**Deliverables**:
- Click-to-view waveform popup
- Multi-channel oscilloscope
- Measurement tools
- Pin multiple scopes

### Phase 4: Advanced Visualization (Low Priority / Polish)
**Timeline**: 2-3 weeks
**Effort**: ~25-35 hours

**Week 1**: Phase visualization
- [ ] Extract phase from AC analysis
- [ ] Color-code wires by phase
- [ ] Phase angle indicators

**Week 2**: Phasor diagrams
- [ ] Create PhasorDiagram component
- [ ] Rotating phasor animation
- [ ] Interactive phasor selection

**Week 3**: Enhanced visuals
- [ ] Wire thickness scaling
- [ ] Heat map overlay
- [ ] Vector field (optional)

**Deliverables**:
- Phase-colored wires
- Phasor diagram window
- Enhanced visual feedback

---

## 🧪 Testing Plan

### Manual Testing Checklist

#### Basic Animation (Phase 1) ✅
- [x] Create simple AC circuit (VAC + R + GND)
- [x] Run transient simulation
- [x] Verify particles appear and flow
- [x] Check AC oscillation (back-and-forth motion)
- [x] Test animation ON/OFF toggle
- [x] Test speed slider (0.1x to 3.0x)
- [x] Verify build completes without errors

#### Real-Time Simulation (Phase 2)
- [ ] Start simulation in continuous mode
- [ ] Verify particles sync with waveform
- [ ] Test Play/Pause/Restart buttons
- [ ] Seek to different time points with scrubber
- [ ] Test with different frequencies (1Hz, 60Hz, 1kHz, 100kHz)
- [ ] Test with multiple VAC sources
- [ ] Verify performance (should maintain 30+ FPS)

#### Interactive Waveforms (Phase 3)
- [ ] Click on wire → scope opens
- [ ] Click on component → scope opens
- [ ] Verify correct signal displayed
- [ ] Pin multiple scopes simultaneously
- [ ] Drag scope windows around
- [ ] Test V/div and time/div controls
- [ ] Verify measurements (RMS, peak-to-peak, frequency)

#### Phase Visualization (Phase 4)
- [ ] Verify phase colors match AC analysis
- [ ] Test phasor diagram rotation
- [ ] Check phase angle indicators
- [ ] Test with RC, RL, RLC circuits (different phase shifts)

### Automated Testing (Future)
- [ ] Unit tests for ParticleSystem.js
- [ ] Integration tests for simulation pipeline
- [ ] Performance benchmarks (FPS, memory usage)
- [ ] Visual regression tests (screenshot comparison)

---

## 📊 Performance Considerations

### Current Performance Profile
- **Particle count**: ~2-15 per wire (scales with current)
- **Update frequency**: 60 FPS
- **Render method**: Canvas 2D (software rendering)
- **Typical circuit**: 10-20 wires → 50-300 particles total
- **Performance**: Good on modern hardware

### Optimization Strategies (If Needed)

#### If FPS drops below 30:
1. **Reduce particle count**
   - Lower the scaling factor (fewer particles per ampere)
   - Cap maximum particles per wire (e.g., max 10)

2. **Use WebGL rendering**
   - Replace Canvas 2D with PixiJS or custom WebGL
   - Batch render all particles in one draw call
   - GPU acceleration for 1000+ particles

3. **Reduce update frequency**
   - Update particles at 30 FPS instead of 60
   - Interpolate positions between updates

4. **Lazy rendering**
   - Only render visible particles (viewport culling)
   - Skip rendering for very small currents (<1nA)

#### Memory Management
- Clear particles when simulation stops
- Limit maximum simultaneous scopes (e.g., max 4)
- Use object pooling for particles (reuse instead of create/destroy)

---

## 🎨 Visual Design Notes

### Particle Appearance
- **Glow effect**: `ctx.shadowBlur = 8`
- **AC particles**: Blue (`rgba(0, 200, 255, 0.9)`)
- **DC particles**: Yellow/Gold (`rgba(255, 220, 0, 0.9)`)
- **Size**: 2.5px inner dot, 5px outer glow
- **Spacing**: Evenly distributed along wire (position = i / particleCount)

### Color Palette (Future Phase 4)
- **Phase colors** (0° to 360°):
  - 0° (0rad): Red `#FF0000`
  - 90° (π/2): Green `#00FF00`
  - 180° (π): Cyan `#00FFFF`
  - 270° (3π/2): Blue `#0000FF`
  - 360° (2π): Red `#FF0000` (wraps)

### Animation Curves
- **AC velocity**: `v(t) = v₀ × sin(2πft + φ)`
- **Easing**: None (linear interpolation for smooth motion)
- **Position wrapping**: When particle reaches end (position > 1), wrap to 0

---

## 🐛 Known Issues & Limitations

### Current Limitations
1. **Static current values**: Particles animate with constant current from final time step
   - **Impact**: Not truly "live" during transient
   - **Fix**: Phase 2 implementation

2. **Generic sinusoidal motion**: Not synchronized with actual waveform
   - **Impact**: Phase relationships may be inaccurate
   - **Fix**: Phase 2 (accurate waveform sync)

3. **Single frequency only**: Uses first VAC component's frequency for all wires
   - **Impact**: Multi-frequency circuits animate incorrectly
   - **Fix**: Phase 2 (superposition support)

4. **No click interaction**: Can't click to see waveforms
   - **Impact**: Less interactive than EveryCircuit
   - **Fix**: Phase 3 implementation

### Potential Bugs to Watch For
- **NaN positions**: If wire path is empty or malformed
  - **Mitigation**: Null checks in `getPositionOnPath()`

- **Memory leaks**: Particles not cleaned up on circuit changes
  - **Mitigation**: `useEffect` cleanup in Canvas.jsx

- **Performance degradation**: Too many particles with complex circuits
  - **Mitigation**: Particle count caps, optimization strategies above

---

## 📚 References & Resources

### EveryCircuit Features
- Website: https://everycircuit.com/
- Video demos: YouTube "EveryCircuit tutorial"
- Key features to emulate: Real-time animation, click-to-view, phase visualization

### Technical Resources
- **ngspice Manual**: http://ngspice.sourceforge.net/docs/ngspice-html-manual/manual.xhtml
  - Transient analysis: Section 15.3.16
  - AC analysis: Section 15.3.1

- **Canvas Animation**:
  - MDN: https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Basic_animations
  - requestAnimationFrame: https://developer.mozilla.org/en-US/docs/Web/API/window/requestAnimationFrame

- **Chart Libraries** (for Phase 3):
  - uPlot: https://github.com/leeoniya/uPlot (high-performance, used in current app)
  - Chart.js: https://www.chartjs.org/
  - D3.js: https://d3js.org/ (advanced, higher complexity)

### Similar Projects
- Falstad Circuit Simulator: https://www.falstad.com/circuit/
- CircuitJS: https://www.falstad.com/circuit/circuitjs.html (open source version)
- LTspice: https://www.analog.com/en/design-center/design-tools-and-calculators/ltspice-simulator.html

---

## 🚀 Quick Start Guide (For New Developers)

### Understanding the Codebase

1. **Entry point**: `sim-front/src/sim/ui/Editor.jsx`
   - Main orchestrator for the simulator
   - Manages circuit state, simulation triggers, UI layout

2. **Rendering**: `sim-front/src/sim/ui/Canvas.jsx`
   - All visual rendering happens here
   - Draws components, wires, particles
   - Handles mouse interactions

3. **Particle logic**: `sim-front/src/sim/ui/ParticleSystem.js`
   - Self-contained animation system
   - No dependencies on React or circuit logic

4. **Backend**: `sim-back/app/services/ngspice_runner.py`
   - Runs ngspice subprocess
   - Returns simulation results as JSON

### Making Your First Change

**Goal**: Change particle color from blue to purple for AC circuits

1. Open `sim-front/src/sim/ui/ParticleSystem.js`
2. Find the `render()` method (line ~200)
3. Change:
   ```javascript
   ctx.fillStyle = config.isAC
     ? "rgba(0, 150, 255, 0.3)"  // Current: blue
     : "rgba(255, 180, 0, 0.3)";
   ```
   To:
   ```javascript
   ctx.fillStyle = config.isAC
     ? "rgba(150, 0, 255, 0.3)"  // New: purple
     : "rgba(255, 180, 0, 0.3)";
   ```
4. Save and refresh browser
5. Run AC simulation to see purple particles

### Building Locally

```bash
# Frontend (development server)
cd sim-front
npm install
npm run dev
# Opens at http://localhost:5173

# Backend (Python API)
cd sim-back
pip install -r requirements.txt
python -m uvicorn app.main:app --reload
# Runs at http://localhost:8000

# Build for production
cd sim-front
npm run build
# Outputs to sim-front/dist/
```

---

## 🎯 Success Metrics

### Phase 1 (COMPLETED) ✅
- [x] Particles visible on AC circuits
- [x] Animation can be toggled on/off
- [x] Speed controllable (0.1x - 3.0x)
- [x] No console errors
- [x] Build completes successfully

### Phase 2 (Real-Time Simulation)
- [ ] Animation runs continuously without user clicking "Run" again
- [ ] Particles synchronized with waveform (verified by comparing with scope)
- [ ] Playback controls functional (Play/Pause/Restart)
- [ ] Performance: Maintains 30+ FPS on typical circuits (10-20 wires)

### Phase 3 (Interactive Waveforms)
- [ ] Click any wire/component → scope opens in <200ms
- [ ] Can pin 3+ scopes simultaneously
- [ ] Measurements accurate to ±1% (vs ngspice output)
- [ ] Scope window draggable and resizable

### Phase 4 (Advanced Visualization)
- [ ] Phase colors match AC analysis results
- [ ] Phasor diagram rotates smoothly at AC frequency
- [ ] User feedback: "Easier to understand AC circuits"

---

## 💡 Future Enhancements (Beyond EveryCircuit)

### Educational Features
- [ ] **Tutorial mode**: Step-by-step circuit building with explanations
- [ ] **Quiz mode**: "What happens if we increase R1?" → test by simulation
- [ ] **Animations library**: Pre-built circuits (RC filter, RLC resonance, etc.)

### Advanced Analysis
- [ ] **Impedance visualization**: Show Z as complex number on hover
- [ ] **Bode plot integration**: Click component → see frequency response
- [ ] **Power flow animation**: Particles sized by instantaneous power
- [ ] **Fourier analysis**: Show harmonic content of waveforms

### Collaboration
- [ ] **Share circuits**: Generate URL to share circuit
- [ ] **Cloud save**: Store circuits in database
- [ ] **Multiplayer**: Collaborate on same circuit in real-time

### Performance
- [ ] **WebGL acceleration**: Handle 100+ wires smoothly
- [ ] **WebAssembly ngspice**: Run simulation in browser (no backend needed)
- [ ] **GPU compute shaders**: Offload particle updates to GPU

---

## 📝 Changelog

### v0.2.0 - AC Animation (Current)
**Date**: 2025-01-XX

**Added**:
- ParticleSystem class for current flow animation
- AC/DC particle motion (sinusoidal for AC, constant for DC)
- Animation controls (ON/OFF toggle, speed slider)
- Automatic AC frequency detection from VAC components
- Glowing particle rendering with color differentiation

**Technical**:
- New file: `ParticleSystem.js`
- Modified: `Canvas.jsx` (particle integration)
- Modified: `Editor.jsx` (animation controls UI)

### v0.1.0 - Initial Simulator (Before)
**Features**:
- Digital circuit simulation (gates, flip-flops, etc.)
- Analog simulation (ngspice integration)
- Transient, AC, and operating point analysis
- Graph modal for viewing waveforms
- Component properties panel

---

## 👥 Contributors & Acknowledgments

**Implementation**: AI Assistant (Claude Sonnet 4.5)
**Project Owner**: [Your Name]
**Inspiration**: EveryCircuit app by Frankie Ranallo
**Tools**: React, ngspice, Canvas API, uPlot

---

## 📄 License & Usage

This implementation is part of a personal/educational circuit simulator project.

**Dependencies**:
- ngspice: BSD 3-Clause License
- React: MIT License
- uPlot: MIT License

---

## 🏁 Conclusion

**Current Status**: Phase 1 complete! You now have beautiful animated current flow for AC circuits.

**Next Steps**:
1. Test the current implementation with various AC circuits
2. Gather user feedback
3. Decide whether to prioritize Phase 2 (real-time) or Phase 3 (interactive waveforms)

**Total Remaining Work**: ~75-105 hours spread across 3 phases

**Recommendation**: Start with Phase 2 (real-time simulation) as it significantly improves the animation quality and makes it more like EveryCircuit's live mode. Phase 3 (interactive waveforms) can follow as it builds upon the time-series data from Phase 2.

---

**Last Updated**: 2025-01-XX
**Document Version**: 1.0
