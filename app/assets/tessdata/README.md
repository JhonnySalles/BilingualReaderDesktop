# Tessdata OCR packs

Bundled languages (from Android assets): `eng`, `por`, `jpn`, `jpn_vert`.

At runtime they are copied to `%userData%/cache/Tesseract/tessdata/`.

## Upgrade to tessdata_best

Download better packs from https://github.com/tesseract-ocr/tessdata_best and place as:

- `userData/cache/Tesseract/tessdata/jpn.traineddata.best`
- (same for `eng`, `por`, `jpn_vert`)

On next OCR run, missing `.traineddata` files are filled from `.traineddata.best` when present.
You can also replace the `.traineddata` files directly.
