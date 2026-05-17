# @bc/icons-tc-local

Optional plugin that, **if the user already has Total Commander installed locally**, reads its icon resources at runtime and exposes them to BC. Nothing TC-related ships in BC — this plugin only loads bytes the user already owns on their own machine.

**Manifest** (in `package.json`)
```
"bc": { "capabilities": [], "requires": ["fs.read"] }
```

Auto-disabled in `browser-pure` targets (no `fs.read`). Active on Electron, Node sidecar, and any future target that exposes local filesystem access.

**Status:** scaffold. Real DLL parsing and icon-registry wiring land when the icon registry and `fs-node` plugin are in place.

**Why it exists:** TC's icons are proprietary, so the project can't bundle them. But a user with a legitimate TC install can opt into using *their own* icons inside BC — fully legal because no bytes are redistributed by BC.
