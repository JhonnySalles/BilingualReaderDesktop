# Downloads llama-server.exe (Windows x64) and a lightweight model (Qwen2.5-1.5B-Instruct GGUF)
# into public/assets/llm/ for bundled offline LLM inference.
#
# Usage (run from repo root):
#   powershell -ExecutionPolicy Bypass -File ./scripts/fetch-llm.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$DestDir = Join-Path $Root "public\assets\llm"

if (!(Test-Path $DestDir)) {
    New-Item -ItemType Directory -Force -Path $DestDir | Out-Null
}

$ServerExe = Join-Path $DestDir "llama-server.exe"
$ModelFile = Join-Path $DestDir "Qwen2.5-1.5B-Instruct-Q4_K_M.gguf"

# 1. Check llama-server.exe
if (Test-Path $ServerExe) {
    Write-Host "[OK] llama-server.exe already exists at $ServerExe"
} else {
    Write-Host "Downloading llama.cpp Windows x64 release..."
    $ZipUrl = "https://github.com/ggerganov/llama.cpp/releases/download/b4404/llama-b4404-bin-win-avx2-x64.zip"
    $TempZip = Join-Path $DestDir "llama-temp.zip"

    try {
        Invoke-WebRequest -Uri $ZipUrl -OutFile $TempZip -UseBasicParsing
        Write-Host "Extracting llama-server.exe..."
        Expand-Archive -Path $TempZip -DestinationPath (Join-Path $DestDir "temp_extract") -Force
        
        $ExtractedServer = Get-ChildItem -Path (Join-Path $DestDir "temp_extract") -Filter "llama-server.exe" -Recurse | Select-Object -First 1
        if ($ExtractedServer) {
            Move-Item -Path $ExtractedServer.FullName -Destination $ServerExe -Force
            # Also copy required dlls if any
            Get-ChildItem -Path (Join-Path $DestDir "temp_extract") -Filter "*.dll" -Recurse | ForEach-Object {
                Copy-Item -Path $_.FullName -Destination $DestDir -Force
            }
            Write-Host "[OK] llama-server.exe successfully installed."
        } else {
            Write-Warning "Could not find llama-server.exe inside the downloaded archive."
        }
    } finally {
        if (Test-Path $TempZip) { Remove-Item -Force $TempZip }
        $TempExtract = Join-Path $DestDir "temp_extract"
        if (Test-Path $TempExtract) { Remove-Item -Recurse -Force $TempExtract }
    }
}

# 2. Check GGUF model
if (Test-Path $ModelFile) {
    Write-Host "[OK] Model file already exists at $ModelFile"
} else {
    Write-Host "Downloading Qwen2.5-1.5B-Instruct-Q4_K_M.gguf (~986MB)..."
    $ModelUrl = "https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf"
    Invoke-WebRequest -Uri $ModelUrl -OutFile $ModelFile -UseBasicParsing
    Write-Host "[OK] Model downloaded successfully to $ModelFile"
}

Write-Host "`nAll done! Local LLM is ready in $DestDir"
