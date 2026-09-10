# BilingualReaderDesktop

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 19.2.27.

## Development server

```bash
yarn electron:dev
```

Or Angular only: `ng serve` → http://localhost:4200/

## Ebook conversion (native + CLI)

Converters live under `app/services/ebook-convert/`:

| Adapter | Formats | Notes |
|---------|---------|--------|
| Passthrough | EPUB/KEPUB | Always |
| libmobi | MOBI/PRC/AZW/AZW3 | N-API addon (Windows x64 first) |
| Document JS | TXT/MD/HTML/DOCX | No CLI |
| FB2 | FictionBook | XML → EPUB |
| Pandoc / Calibre | broad | When installed on PATH |

### Native libmobi (optional)

Requires **Visual Studio Build Tools** (C++ workload) on Windows.

```bash
yarn fetch:libmobi
yarn build:native
```

If the addon is missing, Calibre/Pandoc still convert MOBI when available.

libmobi is LGPL — sources: https://github.com/bfabiszewski/libmobi

### Smoke tests

```bash
yarn test:epub-packer
yarn test:ebook-convert-smoke
```

## Building

```bash
yarn build:electron
```

## Running unit tests

```bash
ng test
```
