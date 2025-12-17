
# 🧠 Logic Simulator Roadmap & IC Creation Plan

## Overview

This document defines the **required foundation**, **recommended enhancements**, and **complete plan** for evolving a canvas-based digital logic simulator into a **hierarchical, IC-based design tool**, similar to professional EDA software (Logisim, Digital, HDL modules).

The goal is to move from:

> *“drawing gates and wires”*
> to
> *“designing reusable digital ICs”*

---

## 1️⃣ Core Philosophy (Design Principles)

Before implementation, these principles must guide all decisions:

* **Predictability**: User actions should never fail silently.
* **Observability**: Users must always understand *why* a signal is `0`, `1`, or `X`.
* **Hierarchy**: Circuits can be abstracted into reusable components (ICs).
* **Non-destructive UX**: Dragging, selecting, editing should never cause unintended side-effects.
* **Scalability**: The system must support large designs without visual clutter.

---

## 2️⃣ BASIC COMPONENTS (MANDATORY BEFORE IC CREATION)

These components form the **minimum standard library**.
Without them, IC creation will be confusing or unusable.

### 2.1 Input Components

#### 2.1.1 Toggle Input

* Persistent `0` / `1`
* Used for static data input
* Already exists

#### 2.1.2 Button (Momentary Input)

* Output = `1` only while pressed
* Essential for:

  * Testing sequential circuits
  * Triggering clocked logic
* Required before flip-flops and counters

---

### 2.2 Output / Debug Components (CRITICAL)

#### 2.2.1 LED

* Visual signal indicator
* Already exists

#### 2.2.2 Probe (**MANDATORY**)

* Displays signal value numerically: `0 / 1 / X`
* Can attach to:

  * Wires
  * Pins
  * Junctions
* Used to debug:

  * Floating inputs
  * Unknown propagation
  * IC internals later

> ❗ Without Probe, users cannot debug ICs.

---

### 2.3 Timing Component

#### 2.3.1 Clock (**MANDATORY**)

* Periodic square-wave generator
* Adjustable frequency
* Required for:

  * Sequential logic
  * State machines
  * Counters
  * IC testing

---

### 2.4 Combinational Gates (Minimum Set)

Required:

* NOT
* AND
* OR
* XOR

Recommended:

* NAND
* NOR
* XNOR

This set enables:

* Half Adder
* Full Adder
* Multiplexers
* Decoders

---

### 2.5 Junction / Net Node

* Acts as a signal distribution point
* Supports unlimited fan-out
* Already implemented

---

## 3️⃣ STRONGLY RECOMMENDED (BEFORE IC CREATION)

These are not strictly mandatory, but **highly recommended** to avoid poor UX.

### 3.1 Constant Sources

* `VCC` (always HIGH)
* `GND` (always LOW)

Benefits:

* Cleaner IC interfaces
* Avoids dummy inputs
* More realistic circuit modeling

---

### 3.2 Buffer / Delay Gate

* Pass-through gate
* Optional propagation delay

Used for:

* Timing visualization
* Signal conditioning
* Teaching propagation concepts

---

## 4️⃣ SEQUENTIAL LOGIC (MINIMUM FOR REAL ICs)

At least **one memory element** is required.

### 4.1 D Flip-Flop (**MANDATORY FOR ICs**)

* Edge-triggered
* Enables:

  * Registers
  * Counters
  * FSMs
  * Realistic ICs

Optional later:

* SR Latch
* JK Flip-Flop
* T Flip-Flop

---

## 5️⃣ UX REQUIREMENTS (MUST BE SOLID BEFORE ICs)

These must be stable before hierarchical design:

### 5.1 Wiring UX

* Hover highlight on pins and junctions
* Valid connection preview (green)
* Invalid connection preview (red)
* Clear feedback for invalid attempts

### 5.2 Drag & Click Separation

* Dragging components/junctions must not start wires
* Click vs drag distinction must be reliable

### 5.3 Debug Visibility

* Probe must clearly show signal states
* Unknown (`X`) propagation should be understandable

---

## 6️⃣ IC CREATION – CONCEPTUAL MODEL

IC creation introduces **hierarchical design**.

### 6.1 What is an IC?

An IC is:

* A **saved sub-circuit**
* With a **defined interface**
* That behaves like a normal component

---

### 6.2 IC Creation Workflow

#### Step 1: Sub-Circuit Selection

* User selects a group of components
* Selection defines the IC’s internal implementation

#### Step 2: Interface Definition

* Pins connected to outside become IC pins
* User confirms:

  * Input pins (names + order)
  * Output pins (names + order)

Example:

```
IC: HALF_ADDER
Inputs: A, B
Outputs: SUM, CARRY
```

---

#### Step 3: Freeze Implementation

* Internal components + wires are stored
* Coordinates become relative
* No external dependencies allowed

---

#### Step 4: IC Registration

* New component appears in palette
* Treated like any other gate
* Visually rendered as a chip/IC block

---

#### Step 5: Simulation Delegation

* When IC is used:

  * Inputs are passed to internal circuit
  * Internal simulation runs
  * Outputs are exposed

To the outside:

> IC behaves like a black-box gate.

---

## 7️⃣ IC DESIGN RULES (IMPORTANT)

* ICs may contain:

  * Gates
  * Junctions
  * Other ICs (hierarchy allowed, but depth-limited)
* IC internals are hidden by default
* Double-click or “Edit IC” opens internal view
* Editing IC updates all instances (or versioned later)

---

## 8️⃣ IMPLEMENTATION ORDER (RECOMMENDED)

Follow this order strictly to avoid rework:

1. Probe
2. Clock
3. Button Input
4. D Flip-Flop
5. Constant VCC/GND
6. UX polish (hover, invalid feedback)
7. IC creation (selection → interface → palette)

---

## 9️⃣ FUTURE EXTENSIONS (NOT NOW)

These should be designed for, but not implemented yet:

* Auto-junction on wire crossings
* Bus / multi-bit wires
* IC versioning
* Parameterized ICs
* Export to HDL (Verilog-like)
* Timing analysis

---

## 10️⃣ Final Goal

When complete, the simulator should allow users to:

* Build a Half Adder
* Convert it into an IC
* Reuse it to build:

  * Full Adder
  * 4-bit Adder
  * ALU
  * CPU blocks

At that point, the simulator moves from **toy** → **tool**.

---

**End of Plan**

