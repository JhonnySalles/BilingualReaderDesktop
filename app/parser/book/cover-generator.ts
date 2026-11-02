export class CoverGenerator {
  public static generateSvgCover(title: string, author?: string, ext?: string): Buffer {
    const safeTitle = this.escapeXml(title || 'Sem Título');
    const safeAuthor = this.escapeXml(author || 'Autor Desconhecido');
    const safeExt = this.escapeXml((ext || '').replace(/^\./, '').toUpperCase());

    // Quebra o título em até 3 linhas legíveis
    const words = safeTitle.split(/\s+/);
    const lines: string[] = [];
    let currentLine = '';
    for (const word of words) {
      if ((currentLine + ' ' + word).trim().length > 20) {
        if (currentLine) lines.push(currentLine.trim());
        currentLine = word;
      } else {
        currentLine += ' ' + word;
      }
    }
    if (currentLine) lines.push(currentLine.trim());
    const displayLines = lines.slice(0, 3);
    if (lines.length > 3 && displayLines.length === 3) {
      displayLines[2] = displayLines[2].replace(/\.{0,3}$/, '...');
    }

    const titleTspans = displayLines
      .map((line, idx) => `<tspan x="200" dy="${idx === 0 ? '0' : '1.3em'}">${line}</tspan>`)
      .join('');

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 600" width="400" height="600">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1e293b"/>
      <stop offset="50%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#020617"/>
    </linearGradient>
    <linearGradient id="spine" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.18)"/>
      <stop offset="40%" stop-color="rgba(0,0,0,0.5)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0)"/>
    </linearGradient>
    <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#f59e0b"/>
      <stop offset="100%" stop-color="#d97706"/>
    </linearGradient>
  </defs>

  <!-- Fundo do Livro -->
  <rect width="400" height="600" fill="url(#bg)"/>

  <!-- Lombada e Sombra Tridimensional -->
  <rect x="0" y="0" width="28" height="600" fill="url(#spine)"/>

  <!-- Moldura Dourada Clássica -->
  <rect x="30" y="30" width="340" height="540" fill="none" stroke="url(#gold)" stroke-width="2" rx="8" opacity="0.6"/>
  <rect x="38" y="38" width="324" height="524" fill="none" stroke="url(#gold)" stroke-width="1" rx="6" opacity="0.3"/>

  <!-- Selo do Formato -->
  ${
    safeExt
      ? `<rect x="170" y="48" width="60" height="22" fill="#d97706" rx="4"/>
  <text x="200" y="63" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="bold" fill="#0f172a" text-anchor="middle">${safeExt}</text>`
      : ''
  }

  <!-- Título Principal -->
  <text x="200" y="230" font-family="Georgia, Cambria, 'Times New Roman', serif" font-size="24" font-weight="bold" fill="#fef3c7" text-anchor="middle">
    ${titleTspans}
  </text>

  <!-- Divisor Ornamental -->
  <line x1="140" y1="360" x2="260" y2="360" stroke="url(#gold)" stroke-width="1.5" opacity="0.6"/>
  <circle cx="200" cy="360" r="3.5" fill="#f59e0b"/>

  <!-- Autor -->
  <text x="200" y="405" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="16" font-style="italic" fill="#cbd5e1" text-anchor="middle">
    ${safeAuthor}
  </text>

  <!-- Marca D'água Elegante Rodapé -->
  <text x="200" y="542" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="10" letter-spacing="2" fill="#64748b" text-anchor="middle">
    BILINGUAL READER
  </text>
</svg>`;

    return Buffer.from(svg, 'utf-8');
  }

  private static escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
