---
"@llm-workbench/runtime": patch
---

Prevent redaction paths from polluting Object.prototype or changing the exported clone's prototype while preserving redaction of own __proto__ data keys.
