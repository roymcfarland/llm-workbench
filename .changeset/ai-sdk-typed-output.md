---
"@llm-workbench/ai-sdk": minor
---

Preserve structured output inference through tracedGenerateText and tracedStreamText for AI SDK 5 and 7. Calls without an output specification and pre-typed options keep their existing result types; tracing and artifact behavior are unchanged. Add declaration and type tests against both SDK versions.
