import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawn } from 'child_process';
import { OcrBlock, OcrProvider, OcrRecognizeInput, OcrResult } from './ocr.types';

/**
 * Optional Windows.Media.Ocr via PowerShell + WinRT.
 * Returns unavailable when not on win32 or when the script fails.
 */
export class WindowsOcrProvider implements OcrProvider {
  readonly id = 'windows' as const;
  private availableCache: boolean | null = null;

  async isAvailable(): Promise<boolean> {
    if (process.platform !== 'win32') return false;
    if (this.availableCache != null) return this.availableCache;
    try {
      const probe = await this.runPs(`
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Media.Ocr.OcrEngine,Windows.Foundation,ContentType=WindowsRuntime]
'ok'
`);
      this.availableCache = /ok/.test(probe);
    } catch {
      this.availableCache = false;
    }
    return this.availableCache;
  }

  async recognize(input: OcrRecognizeInput): Promise<OcrResult> {
    if (!(await this.isAvailable())) {
      throw new Error('Windows OCR indisponível');
    }

    let imagePath = input.imagePath;
    let tempFile: string | null = null;
    if (!imagePath && input.dataUrl) {
      tempFile = this.writeDataUrlTemp(input.dataUrl);
      imagePath = tempFile;
    }
    if (!imagePath || !fs.existsSync(imagePath)) {
      throw new Error('Imagem OCR não encontrada');
    }

    try {
      const escaped = imagePath.replace(/'/g, "''");
      const json = await this.runPs(`
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1'
})[0]
Function Await($WinRtTask, $ResultType) {
  $netTask = $asTask.MakeGenericMethod($ResultType).Invoke($null, @($WinRtTask))
  $netTask.Wait(-1) | Out-Null
  $netTask.Result
}
$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
if (-not $engine) { throw 'No OCR engine' }
$file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync('${escaped}')) ([Windows.Storage.StorageFile])
$stream = Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
$decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
$bitmap = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
$result = Await ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
$blocks = @()
foreach ($line in $result.Lines) {
  foreach ($word in $line.Words) {
    $r = $word.BoundingRect
    $blocks += [ordered]@{
      text = $word.Text
      x = [int]$r.X
      y = [int]$r.Y
      width = [int]$r.Width
      height = [int]$r.Height
    }
  }
}
@{ fullText = $result.Text; blocks = $blocks } | ConvertTo-Json -Compress -Depth 5
`);
      const parsed = JSON.parse(json.trim().split(/\r?\n/).filter(Boolean).pop() || '{}');
      const blocks: OcrBlock[] = Array.isArray(parsed.blocks)
        ? parsed.blocks.map((b: any) => ({
            text: String(b.text || ''),
            x: Number(b.x) || 0,
            y: Number(b.y) || 0,
            width: Math.max(1, Number(b.width) || 1),
            height: Math.max(1, Number(b.height) || 1)
          }))
        : [];
      return {
        fullText: String(parsed.fullText || '').trim(),
        blocks,
        engine: 'windows'
      };
    } finally {
      if (tempFile) {
        try {
          fs.unlinkSync(tempFile);
        } catch {}
      }
    }
  }

  private writeDataUrlTemp(dataUrl: string): string {
    const m = /^data:image\/(\w+);base64,(.+)$/i.exec(dataUrl);
    if (!m) throw new Error('dataUrl inválido');
    const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
    const file = path.join(os.tmpdir(), `br-ocr-${Date.now()}.${ext}`);
    fs.writeFileSync(file, Buffer.from(m[2], 'base64'));
    return file;
  }

  private runPs(script: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const encoded = Buffer.from(script, 'utf16le').toString('base64');
      const child = spawn(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded],
        { windowsHide: true }
      );
      let out = '';
      let err = '';
      child.stdout.on('data', (d) => (out += d.toString()));
      child.stderr.on('data', (d) => (err += d.toString()));
      child.on('error', reject);
      child.on('close', (code) => {
        if (code === 0) resolve(out);
        else reject(new Error(err || out || `PowerShell exited ${code}`));
      });
    });
  }
}
