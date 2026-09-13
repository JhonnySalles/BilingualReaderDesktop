# Bundled Local LLM Directory

This directory is used for the bundled offline LLM inference engine.

## Required files:
1. `llama-server.exe` (or `llama-server` on Linux/macOS)
2. A `.gguf` model file (e.g. `Qwen2.5-1.5B-Instruct-Q4_K_M.gguf` or `Llama-3.2-1B-Instruct-Q4_K_M.gguf`)

## Automatic Download:
Run the PowerShell script from the repository root:
```powershell
powershell -ExecutionPolicy Bypass -File ./scripts/fetch-llm.ps1
```
Or run `yarn fetch:llm` (if added to package.json scripts).
