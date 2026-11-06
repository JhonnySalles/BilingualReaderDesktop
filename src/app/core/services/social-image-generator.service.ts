import { Injectable } from '@angular/core';
import {
  PlatformPresetConfig,
  SocialLayoutTemplate,
  SocialPlatformPreset,
  SocialRenderOptions,
  SocialShareItem,
  SocialTheme
} from '../models/social-share.model';
import { formatReadingDuration } from './statistics.service';

export const PLATFORM_PRESETS: PlatformPresetConfig[] = [
  {
    id: 'INSTAGRAM_POST',
    label: 'Instagram Post (Retrato)',
    sublabel: 'Feed 4:5 • Ideal para visualização em tela cheia',
    width: 1080,
    height: 1350,
    aspectRatioLabel: '4:5',
    recommendedTemplate: 'BENTO_GRID'
  },
  {
    id: 'INSTAGRAM_STORY',
    label: 'Instagram Stories / Reels',
    sublabel: 'Vertical 9:16 • Formato Story / Status',
    width: 1080,
    height: 1920,
    aspectRatioLabel: '9:16',
    recommendedTemplate: 'WRAPPED_STATS'
  },
  {
    id: 'INSTAGRAM_SQUARE',
    label: 'Instagram Quadrado',
    sublabel: 'Quadrado 1:1 • Carrossel e Feed clássico',
    width: 1080,
    height: 1080,
    aspectRatioLabel: '1:1',
    recommendedTemplate: 'BENTO_GRID'
  },
  {
    id: 'TWITTER_POST',
    label: 'Twitter / X Post',
    sublabel: 'Horizontal 16:9 • Sem corte no feed',
    width: 1600,
    height: 900,
    aspectRatioLabel: '16:9',
    recommendedTemplate: 'PERSPECTIVE_SHOWCASE'
  },
  {
    id: 'TUMBLR_POST',
    label: 'Tumblr / Pôster Gráfico',
    sublabel: 'Vertical 2:3 • Estilo editorial e pôster',
    width: 1200,
    height: 1800,
    aspectRatioLabel: '2:3',
    recommendedTemplate: 'MINIMALIST_LIST'
  }
];

@Injectable({
  providedIn: 'root'
})
export class SocialImageGeneratorService {
  private imageCache = new Map<string, HTMLImageElement>();

  public getPresetConfig(preset: SocialPlatformPreset): PlatformPresetConfig {
    return (
      PLATFORM_PRESETS.find(p => p.id === preset) ?? PLATFORM_PRESETS[0]
    );
  }

  /**
   * Renderiza os dados no canvas fornecido e retorna o DataURL (PNG).
   */
  public async renderToCanvas(
    canvas: HTMLCanvasElement,
    items: SocialShareItem[],
    options: SocialRenderOptions
  ): Promise<string> {
    const preset = this.getPresetConfig(options.preset);
    canvas.width = preset.width;
    canvas.height = preset.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Falha ao obter contexto 2D do Canvas');
    }

    // Carregar todas as imagens de capa necessárias
    const loadedCovers = await this.preloadCovers(items);

    // 1. Renderizar Fundo (Background / Mesh)
    await this.renderBackground(ctx, preset.width, preset.height, options.theme, loadedCovers);

    // 2. Renderizar Header / Título / Subtítulo
    const contentTop = this.renderHeader(ctx, preset.width, options);

    // 3. Renderizar Rodapé / Branding / Stats
    const contentBottom = this.renderFooter(ctx, preset.width, preset.height, options, items);

    // 4. Renderizar Miolo com as Capas e layout selecionado
    const availableRect = {
      x: 60,
      y: contentTop,
      width: preset.width - 120,
      height: contentBottom - contentTop
    };

    switch (options.template) {
      case 'BENTO_GRID':
        this.renderBentoGrid(ctx, availableRect, items, loadedCovers, options);
        break;
      case 'PERSPECTIVE_SHOWCASE':
        this.renderPerspectiveShowcase(ctx, availableRect, items, loadedCovers, options);
        break;
      case 'WRAPPED_STATS':
        this.renderWrappedStats(ctx, availableRect, items, loadedCovers, options);
        break;
      case 'MINIMALIST_LIST':
        this.renderMinimalistList(ctx, availableRect, items, loadedCovers, options);
        break;
      default:
        this.renderBentoGrid(ctx, availableRect, items, loadedCovers, options);
        break;
    }

    return canvas.toDataURL('image/png');
  }

  // ==========================================
  // Carregamento de Capas e Cores
  // ==========================================

  private async preloadCovers(items: SocialShareItem[]): Promise<Map<string, HTMLImageElement>> {
    const map = new Map<string, HTMLImageElement>();
    const promises = items.map(async item => {
      if (!item.coverPath) return;
      const url = 'local-cover:///' + item.coverPath.replace(/\\/g, '/');
      if (this.imageCache.has(url)) {
        map.set(item.coverPath, this.imageCache.get(url)!);
        return;
      }
      try {
        const img = await this.loadImage(url);
        this.imageCache.set(url, img);
        map.set(item.coverPath, img);
      } catch {
        // Ignora erro caso a imagem não carregue
      }
    });

    await Promise.all(promises);
    return map;
  }

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = e => reject(e);
      img.src = src;
    });
  }

  private extractPredominantColors(
    covers: Map<string, HTMLImageElement>
  ): { primary: string; secondary: string; accent: string } {
    const defaultPalette = {
      primary: 'rgb(24, 24, 37)',
      secondary: 'rgb(15, 23, 42)',
      accent: 'rgb(99, 102, 241)'
    };

    if (covers.size === 0) return defaultPalette;

    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return defaultPalette;

    let totalR = 0,
      totalG = 0,
      totalB = 0,
      count = 0;

    for (const img of covers.values()) {
      try {
        ctx.drawImage(img, 0, 0, 64, 64);
        const data = ctx.getImageData(0, 0, 64, 64).data;
        for (let i = 0; i < data.length; i += 16) {
          totalR += data[i];
          totalG += data[i + 1];
          totalB += data[i + 2];
          count++;
        }
      } catch {
        // fallback seguro
      }
    }

    if (count === 0) return defaultPalette;

    const r = Math.round(totalR / count);
    const g = Math.round(totalG / count);
    const b = Math.round(totalB / count);

    return {
      primary: `rgb(${Math.max(15, Math.min(60, r))}, ${Math.max(15, Math.min(60, g))}, ${Math.max(25, Math.min(80, b))})`,
      secondary: `rgb(${Math.max(8, r - 40)}, ${Math.max(10, g - 40)}, ${Math.max(18, b - 30)})`,
      accent: `rgb(${Math.min(255, r + 70)}, ${Math.min(255, g + 70)}, ${Math.min(255, b + 100)})`
    };
  }

  // ==========================================
  // Renderização de Fundo (Background)
  // ==========================================

  private async renderBackground(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    theme: SocialTheme,
    covers: Map<string, HTMLImageElement>
  ): Promise<void> {
    ctx.save();

    if (theme === 'OLED_BLACK') {
      ctx.fillStyle = '#05070a';
      ctx.fillRect(0, 0, w, h);
    } else if (theme === 'WARM_PAPER') {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#f9f6f0');
      grad.addColorStop(1, '#ebe4d5');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    } else if (theme === 'CYBER_NEON') {
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#0f0c29');
      grad.addColorStop(0.5, '#302b63');
      grad.addColorStop(1, '#24243e');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    } else if (theme === 'DARK_SLATE') {
      const grad = ctx.createRadialGradient(w / 2, h / 3, 50, w / 2, h / 2, Math.max(w, h));
      grad.addColorStop(0, '#1e293b');
      grad.addColorStop(0.7, '#0f172a');
      grad.addColorStop(1, '#020617');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    } else {
      // AMBIENT_DYNAMIC (Dynamic Mesh)
      const palette = this.extractPredominantColors(covers);
      const bgGrad = ctx.createLinearGradient(0, 0, w, h);
      bgGrad.addColorStop(0, palette.secondary);
      bgGrad.addColorStop(1, '#030712');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      // Orbs suaves coloridos
      const orbGrad1 = ctx.createRadialGradient(w * 0.25, h * 0.2, 20, w * 0.25, h * 0.2, w * 0.65);
      orbGrad1.addColorStop(0, palette.accent);
      orbGrad1.addColorStop(1, 'transparent');
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = orbGrad1;
      ctx.fillRect(0, 0, w, h);

      const orbGrad2 = ctx.createRadialGradient(w * 0.8, h * 0.6, 20, w * 0.8, h * 0.6, w * 0.55);
      orbGrad2.addColorStop(0, palette.primary);
      orbGrad2.addColorStop(1, 'transparent');
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = orbGrad2;
      ctx.fillRect(0, 0, w, h);

      ctx.globalAlpha = 1.0;
    }

    // Grid sutil decorativo para visual moderno
    ctx.strokeStyle = theme === 'WARM_PAPER' ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    const step = 80;
    for (let x = 0; x < w; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    ctx.restore();
  }

  // ==========================================
  // Renderização de Cabeçalho e Rodapé
  // ==========================================

  private renderHeader(
    ctx: CanvasRenderingContext2D,
    w: number,
    options: SocialRenderOptions
  ): number {
    ctx.save();
    const isLight = options.theme === 'WARM_PAPER';

    const startY = 80;
    ctx.textAlign = 'left';

    // Badge / Pill de categoria ou contexto
    ctx.fillStyle = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(99, 102, 241, 0.15)';
    this.roundRect(ctx, 60, startY, 210, 36, 18);
    ctx.fill();

    ctx.fillStyle = isLight ? '#475569' : '#818cf8';
    ctx.font = 'bold 16px "Inter", "Segoe UI", sans-serif';
    ctx.fillText('⚡ READING RECAP', 80, startY + 24);

    // Título Principal
    ctx.fillStyle = isLight ? '#0f172a' : '#f8fafc';
    ctx.font = 'bold 46px "Inter", "Segoe UI", sans-serif';
    ctx.fillText(options.title || 'Minhas Leituras', 60, startY + 84);

    // Subtítulo / Período
    ctx.fillStyle = isLight ? '#64748b' : '#94a3b8';
    ctx.font = '500 22px "Inter", "Segoe UI", sans-serif';
    ctx.fillText(options.subtitle || 'Bilingual Reader', 60, startY + 120);

    ctx.restore();
    return startY + 160;
  }

  private renderFooter(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    options: SocialRenderOptions,
    items: SocialShareItem[]
  ): number {
    ctx.save();
    const isLight = options.theme === 'WARM_PAPER';
    const footerHeight = options.showStatsBanner ? 150 : 90;
    const footerTop = h - footerHeight;

    if (options.showStatsBanner) {
      // Banner com Estatísticas
      const totalWorks = items.length;
      const totalPages = items.reduce((acc, it) => acc + it.pagesReadInPeriod, 0);
      const totalSeconds = items.reduce((acc, it) => acc + it.secondsReadInPeriod, 0);
      const completedCount = items.filter(it => it.completed).length;

      const cardY = footerTop;
      const cardW = w - 120;
      const cardH = 80;

      ctx.fillStyle = isLight ? 'rgba(255,255,255,0.7)' : 'rgba(15, 23, 42, 0.65)';
      ctx.strokeStyle = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 1.5;
      this.roundRect(ctx, 60, cardY, cardW, cardH, 20);
      ctx.fill();
      ctx.stroke();

      const cols = [
        { label: 'OBRAS LIDAS', val: `${totalWorks}` },
        { label: 'PÁGINAS', val: `${totalPages}` },
        { label: 'TEMPO TOTAL', val: formatReadingDuration(totalSeconds) },
        { label: 'CONCLUÍDOS', val: `${completedCount}` }
      ];

      const colW = cardW / cols.length;
      cols.forEach((col, idx) => {
        const colX = 60 + idx * colW + colW / 2;
        ctx.textAlign = 'center';

        ctx.fillStyle = isLight ? '#94a3b8' : '#64748b';
        ctx.font = 'bold 13px "Inter", "Segoe UI", sans-serif';
        ctx.fillText(col.label, colX, cardY + 28);

        ctx.fillStyle = isLight ? '#0f172a' : '#f1f5f9';
        ctx.font = 'bold 24px "Inter", "Segoe UI", sans-serif';
        ctx.fillText(col.val, colX, cardY + 60);

        if (idx < cols.length - 1) {
          ctx.strokeStyle = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)';
          ctx.beginPath();
          ctx.moveTo(60 + (idx + 1) * colW, cardY + 16);
          ctx.lineTo(60 + (idx + 1) * colW, cardY + cardH - 16);
          ctx.stroke();
        }
      });
    }

    // Linha final com Branding e Handle
    const bottomLineY = h - 35;
    ctx.textAlign = 'left';
    ctx.fillStyle = isLight ? '#64748b' : '#64748b';
    ctx.font = '600 16px "Inter", "Segoe UI", sans-serif';

    if (options.showBranding) {
      ctx.fillText('📖 Gerado com Bilingual Reader Desktop', 60, bottomLineY);
    }

    if (options.userHandle) {
      ctx.textAlign = 'right';
      ctx.fillStyle = isLight ? '#475569' : '#94a3b8';
      ctx.fillText(options.userHandle.startsWith('@') ? options.userHandle : `@${options.userHandle}`, w - 60, bottomLineY);
    }

    ctx.restore();
    return footerTop - 30;
  }

  // ==========================================
  // Layout 1: Bento Grid Moderno
  // ==========================================

  private renderBentoGrid(
    ctx: CanvasRenderingContext2D,
    rect: { x: number; y: number; width: number; height: number },
    items: SocialShareItem[],
    covers: Map<string, HTMLImageElement>,
    options: SocialRenderOptions
  ): void {
    if (items.length === 0) return;

    const count = items.length;
    let cols = 3;
    let rows = 2;

    if (count <= 2) {
      cols = count;
      rows = 1;
    } else if (count <= 4) {
      cols = 2;
      rows = 2;
    } else if (count <= 6) {
      cols = 3;
      rows = 2;
    } else if (count <= 9) {
      cols = 3;
      rows = 3;
    } else if (count <= 12) {
      cols = 4;
      rows = 3;
    } else {
      cols = 4;
      rows = 4;
    }

    const gap = 20;
    const cellW = (rect.width - gap * (cols - 1)) / cols;
    const cellH = (rect.height - gap * (rows - 1)) / rows;

    const maxItems = cols * rows;
    const displayItems = items.slice(0, maxItems);

    displayItems.forEach((item, idx) => {
      const c = idx % cols;
      const r = Math.floor(idx / cols);
      const x = rect.x + c * (cellW + gap);
      const y = rect.y + r * (cellH + gap);

      this.drawCoverCard(ctx, x, y, cellW, cellH, item, covers.get(item.coverPath || ''), options);
    });
  }

  // ==========================================
  // Layout 2: Perspective Showcase (Estante Flutuante)
  // ==========================================

  private renderPerspectiveShowcase(
    ctx: CanvasRenderingContext2D,
    rect: { x: number; y: number; width: number; height: number },
    items: SocialShareItem[],
    covers: Map<string, HTMLImageElement>,
    options: SocialRenderOptions
  ): void {
    if (items.length === 0) return;

    const displayItems = items.slice(0, Math.min(items.length, 6));
    const count = displayItems.length;

    // Calcular largura de cada livro proporcional
    const baseCardW = Math.min(240, (rect.width / count) * 1.3);
    const cardH = Math.min(rect.height * 0.8, baseCardW * 1.48);
    const totalSpan = (count - 1) * (baseCardW * 0.7) + baseCardW;
    const startX = rect.x + (rect.width - totalSpan) / 2;
    const startY = rect.y + (rect.height - cardH) / 2;

    displayItems.forEach((item, idx) => {
      const x = startX + idx * (baseCardW * 0.7);
      // Leve efeito de arco parabólico
      const centerDist = Math.abs(idx - (count - 1) / 2);
      const y = startY + centerDist * 16;

      ctx.save();
      // Leve rotação 3D simulada
      const angle = (idx - (count - 1) / 2) * -0.04;
      ctx.translate(x + baseCardW / 2, y + cardH / 2);
      ctx.rotate(angle);
      ctx.translate(-(x + baseCardW / 2), -(y + cardH / 2));

      this.drawCoverCard(ctx, x, y, baseCardW, cardH, item, covers.get(item.coverPath || ''), options);
      ctx.restore();
    });
  }

  // ==========================================
  // Layout 3: Wrapped Stats + Covers
  // ==========================================

  private renderWrappedStats(
    ctx: CanvasRenderingContext2D,
    rect: { x: number; y: number; width: number; height: number },
    items: SocialShareItem[],
    covers: Map<string, HTMLImageElement>,
    options: SocialRenderOptions
  ): void {
    if (items.length === 0) return;

    // Destaque para o livro top/mais lido no topo
    const topItem = items[0];
    const otherItems = items.slice(1, 7);

    const isLight = options.theme === 'WARM_PAPER';
    const topCardH = Math.min(260, rect.height * 0.38);

    // Box do Livro Destaque
    ctx.fillStyle = isLight ? 'rgba(255,255,255,0.85)' : 'rgba(15, 23, 42, 0.75)';
    ctx.strokeStyle = isLight ? 'rgba(0,0,0,0.1)' : 'rgba(99, 102, 241, 0.3)';
    ctx.lineWidth = 1.5;
    this.roundRect(ctx, rect.x, rect.y, rect.width, topCardH, 20);
    ctx.fill();
    ctx.stroke();

    const topCoverW = topCardH * 0.65;
    const topCoverH = topCardH - 32;
    this.drawCoverCard(
      ctx,
      rect.x + 16,
      rect.y + 16,
      topCoverW,
      topCoverH,
      topItem,
      covers.get(topItem.coverPath || ''),
      { ...options, showCoverTitles: false }
    );

    // Informações do destaque
    const textX = rect.x + topCoverW + 40;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#6366f1';
    ctx.font = 'bold 16px "Inter", "Segoe UI", sans-serif';
    ctx.fillText('🏆 MAIOR FOCO DE LEITURA', textX, rect.y + 50);

    ctx.fillStyle = isLight ? '#0f172a' : '#f8fafc';
    ctx.font = 'bold 28px "Inter", "Segoe UI", sans-serif';
    this.drawTruncatedText(ctx, topItem.title, textX, rect.y + 90, rect.width - (textX - rect.x) - 30);

    ctx.fillStyle = isLight ? '#64748b' : '#94a3b8';
    ctx.font = '500 18px "Inter", "Segoe UI", sans-serif';
    const sub = [topItem.author, topItem.series, topItem.volume].filter(Boolean).join(' • ');
    this.drawTruncatedText(ctx, sub, textX, rect.y + 124, rect.width - (textX - rect.x) - 30);

    // Métricas específicas do destaque
    ctx.fillStyle = isLight ? '#475569' : '#cbd5e1';
    ctx.font = '600 16px "Inter", "Segoe UI", sans-serif';
    ctx.fillText(
      `📖 ${topItem.pagesReadInPeriod} páginas lidas  •  ⏱️ ${formatReadingDuration(topItem.secondsReadInPeriod)}`,
      textX,
      rect.y + 168
    );

    // Grid inferior para os outros livros
    if (otherItems.length > 0) {
      const bottomRect = {
        x: rect.x,
        y: rect.y + topCardH + 24,
        width: rect.width,
        height: rect.height - topCardH - 24
      };
      this.renderBentoGrid(ctx, bottomRect, otherItems, covers, options);
    }
  }

  // ==========================================
  // Layout 4: Minimalist Review List
  // ==========================================

  private renderMinimalistList(
    ctx: CanvasRenderingContext2D,
    rect: { x: number; y: number; width: number; height: number },
    items: SocialShareItem[],
    covers: Map<string, HTMLImageElement>,
    options: SocialRenderOptions
  ): void {
    if (items.length === 0) return;

    const displayItems = items.slice(0, 6);
    const isLight = options.theme === 'WARM_PAPER';
    const rowGap = 16;
    const rowH = (rect.height - rowGap * (displayItems.length - 1)) / displayItems.length;

    displayItems.forEach((item, idx) => {
      const rowY = rect.y + idx * (rowH + rowGap);

      // Card fundo
      ctx.fillStyle = isLight ? 'rgba(255,255,255,0.7)' : 'rgba(30, 41, 59, 0.45)';
      ctx.strokeStyle = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      this.roundRect(ctx, rect.x, rowY, rect.width, rowH, 16);
      ctx.fill();
      ctx.stroke();

      // Capa miniatura
      const coverW = (rowH - 16) * 0.68;
      const coverH = rowH - 16;
      this.drawCoverCard(
        ctx,
        rect.x + 10,
        rowY + 8,
        coverW,
        coverH,
        item,
        covers.get(item.coverPath || ''),
        { ...options, showCoverTitles: false }
      );

      // Textos
      const textX = rect.x + coverW + 28;
      ctx.textAlign = 'left';

      ctx.fillStyle = isLight ? '#0f172a' : '#f8fafc';
      ctx.font = 'bold 20px "Inter", "Segoe UI", sans-serif';
      this.drawTruncatedText(ctx, item.title, textX, rowY + rowH * 0.38, rect.width - coverW - 160);

      ctx.fillStyle = isLight ? '#64748b' : '#94a3b8';
      ctx.font = '500 15px "Inter", "Segoe UI", sans-serif';
      const meta = [item.author || item.series, item.volume ? `Vol. ${item.volume}` : ''].filter(Boolean).join(' • ');
      this.drawTruncatedText(ctx, meta, textX, rowY + rowH * 0.7, rect.width - coverW - 160);

      // Status pill à direita
      ctx.textAlign = 'right';
      const statusX = rect.x + rect.width - 24;
      ctx.fillStyle = item.completed ? '#10b981' : '#6366f1';
      ctx.font = 'bold 15px "Inter", "Segoe UI", sans-serif';
      const statusLabel = item.completed ? '✓ CONCLUÍDO' : `${Math.round((item.bookMark / item.pages) * 100)}%`;
      ctx.fillText(statusLabel, statusX, rowY + rowH * 0.52);
    });
  }

  // ==========================================
  // Utilitários de Desenho (Cards, Formas, Textos)
  // ==========================================

  private drawCoverCard(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    item: SocialShareItem,
    coverImg: HTMLImageElement | undefined,
    options: SocialRenderOptions
  ): void {
    ctx.save();

    // Sombra 3D suave
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 12;

    const radius = 14;

    // Fundo da capa / fallback
    ctx.fillStyle = item.type === 'BOOK' ? '#b45309' : '#4338ca';
    this.roundRect(ctx, x, y, w, h, radius);
    ctx.fill();

    // Reset shadow para não vazar no interior
    ctx.shadowColor = 'transparent';

    // Clip para renderizar a imagem com bordas arredondadas
    ctx.save();
    this.roundRect(ctx, x, y, w, h, radius);
    ctx.clip();

    if (coverImg) {
      // Ajuste "cover" (preenche sem distorcer)
      const imgRatio = coverImg.width / coverImg.height;
      const cardRatio = w / h;
      let drawW = w;
      let drawH = h;
      let drawX = x;
      let drawY = y;

      if (imgRatio > cardRatio) {
        drawW = h * imgRatio;
        drawX = x - (drawW - w) / 2;
      } else {
        drawH = w / imgRatio;
        drawY = y - (drawH - h) / 2;
      }

      ctx.drawImage(coverImg, drawX, drawY, drawW, drawH);
    } else {
      // Fallback elegante quando não há capa
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(x, y, w, h);

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.font = 'bold 16px "Inter", sans-serif';
      this.drawWordWrappedText(ctx, item.title, x + w / 2, y + h * 0.4, w - 24, 20);

      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = '500 12px "Inter", sans-serif';
      ctx.fillText(item.author || item.fileType, x + w / 2, y + h * 0.85);
    }

    // Gradiente sutil escuro na base da capa para legibilidade de títulos
    if (options.showCoverTitles) {
      const grad = ctx.createLinearGradient(0, y + h * 0.5, 0, y + h);
      grad.addColorStop(0, 'transparent');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0.85)');
      ctx.fillStyle = grad;
      ctx.fillRect(x, y + h * 0.5, w, h * 0.5);

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.font = 'bold 14px "Inter", sans-serif';
      this.drawTruncatedText(ctx, item.title, x + 12, y + h - 28, w - 24);

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '500 11px "Inter", sans-serif';
      this.drawTruncatedText(ctx, item.author || item.series, x + 12, y + h - 12, w - 24);
    }

    ctx.restore(); // Desfaz clip

    // Borda sutil de destaque
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1.5;
    this.roundRect(ctx, x, y, w, h, radius);
    ctx.stroke();

    // Badge de Concluído ou Tipo
    if (options.showProgressBadge) {
      if (item.completed) {
        ctx.fillStyle = '#10b981';
        this.roundRect(ctx, x + w - 34, y + 10, 24, 24, 12);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.font = 'bold 14px "Inter", sans-serif';
        ctx.fillText('✓', x + w - 22, y + 26);
      } else if (item.bookMark > 0 && item.pages > 1) {
        const pct = `${Math.round((item.bookMark / item.pages) * 100)}%`;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        this.roundRect(ctx, x + w - 48, y + 10, 38, 22, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#e2e8f0';
        ctx.textAlign = 'center';
        ctx.font = 'bold 11px "Inter", sans-serif';
        ctx.fillText(pct, x + w - 29, y + 25);
      }
    }

    ctx.restore();
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    radius: number
  ): void {
    const r = Math.min(radius, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  private drawTruncatedText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number
  ): void {
    if (!text) return;
    if (ctx.measureText(text).width <= maxWidth) {
      ctx.fillText(text, x, y);
      return;
    }

    let truncated = text;
    while (truncated.length > 0 && ctx.measureText(truncated + '…').width > maxWidth) {
      truncated = truncated.slice(0, -1);
    }
    ctx.fillText(truncated + '…', x, y);
  }

  private drawWordWrappedText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number
  ): void {
    const words = (text || '').split(' ');
    let line = '';
    let curY = y;

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        ctx.fillText(line, x, curY);
        line = words[n] + ' ';
        curY += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, curY);
  }
}

