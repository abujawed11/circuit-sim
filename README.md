
```
circuit-sim
├─ README.md
├─ sim-back
│  ├─ app
│  │  ├─ main.py
│  │  ├─ schemas
│  │  │  └─ simulate.py
│  │  └─ services
│  │     ├─ netlist_builder.py
│  │     └─ ngspice_runner.py
│  └─ requirements.txt
└─ sim-front
   ├─ create-sim-structure.ps1
   ├─ dist
   │  ├─ assets
   │  │  ├─ index-Blf2w09e.css
   │  │  └─ index-ComWIuo8.js
   │  ├─ index.html
   │  └─ vite.svg
   ├─ DRAG_WIRE.md
   ├─ eslint.config.js
   ├─ IC_CREATION_PLAN.md
   ├─ IC_CREATION_PROGRESS.md
   ├─ index.html
   ├─ package-lock.json
   ├─ package.json
   ├─ public
   │  └─ vite.svg
   ├─ README.md
   ├─ src
   │  ├─ App.css
   │  ├─ App.jsx
   │  ├─ assets
   │  │  └─ react.svg
   │  ├─ index.css
   │  ├─ main.jsx
   │  └─ sim
   │     ├─ analog
   │     │  ├─ api
   │     │  │  └─ simulateAnalog.js
   │     │  ├─ model
   │     │  │  ├─ analogParts.js
   │     │  │  └─ analogTypes.js
   │     │  └─ netlist
   │     │     ├─ buildNodes.js
   │     │     └─ toSpiceNetlist.js
   │     ├─ engine
   │     │  └─ simulate.js
   │     ├─ model
   │     │  ├─ gates.js
   │     │  └─ types.js
   │     └─ ui
   │        ├─ Canvas.jsx
   │        ├─ Editor.jsx
   │        ├─ ICCreationDialog.jsx
   │        └─ PropertiesPanel.jsx
   └─ vite.config.js

```