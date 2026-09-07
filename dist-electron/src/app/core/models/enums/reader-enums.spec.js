"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const reader_enums_1 = require("./reader-enums");
describe('MangaScrollingMode helpers', () => {
    it('marks only dual modes as dual', () => {
        expect((0, reader_enums_1.isMangaDualMode)(reader_enums_1.MangaScrollingMode.Horizontal)).toBe(false);
        expect((0, reader_enums_1.isMangaDualMode)(reader_enums_1.MangaScrollingMode.HorizontalRtl)).toBe(false);
        expect((0, reader_enums_1.isMangaDualMode)(reader_enums_1.MangaScrollingMode.Vertical)).toBe(false);
        expect((0, reader_enums_1.isMangaDualMode)(reader_enums_1.MangaScrollingMode.LongStrip)).toBe(false);
        expect((0, reader_enums_1.isMangaDualMode)(reader_enums_1.MangaScrollingMode.LongStripGap)).toBe(false);
        expect((0, reader_enums_1.isMangaDualMode)(reader_enums_1.MangaScrollingMode.HorizontalDual)).toBe(true);
        expect((0, reader_enums_1.isMangaDualMode)(reader_enums_1.MangaScrollingMode.HorizontalDualRtl)).toBe(true);
        expect((0, reader_enums_1.isMangaDualMode)(reader_enums_1.MangaScrollingMode.VerticalDual)).toBe(true);
    });
    it('detects horizontal including dual LTR/RTL', () => {
        expect((0, reader_enums_1.isMangaHorizontalMode)(reader_enums_1.MangaScrollingMode.Horizontal)).toBe(true);
        expect((0, reader_enums_1.isMangaHorizontalMode)(reader_enums_1.MangaScrollingMode.HorizontalRtl)).toBe(true);
        expect((0, reader_enums_1.isMangaHorizontalMode)(reader_enums_1.MangaScrollingMode.HorizontalDual)).toBe(true);
        expect((0, reader_enums_1.isMangaHorizontalMode)(reader_enums_1.MangaScrollingMode.HorizontalDualRtl)).toBe(true);
        expect((0, reader_enums_1.isMangaHorizontalMode)(reader_enums_1.MangaScrollingMode.Vertical)).toBe(false);
        expect((0, reader_enums_1.isMangaHorizontalMode)(reader_enums_1.MangaScrollingMode.VerticalDual)).toBe(false);
    });
    it('detects RTL single and dual', () => {
        expect((0, reader_enums_1.isMangaRtlMode)(reader_enums_1.MangaScrollingMode.HorizontalRtl)).toBe(true);
        expect((0, reader_enums_1.isMangaRtlMode)(reader_enums_1.MangaScrollingMode.HorizontalDualRtl)).toBe(true);
        expect((0, reader_enums_1.isMangaRtlMode)(reader_enums_1.MangaScrollingMode.Horizontal)).toBe(false);
        expect((0, reader_enums_1.isMangaRtlMode)(reader_enums_1.MangaScrollingMode.HorizontalDual)).toBe(false);
    });
    it('detects vertical single and dual', () => {
        expect((0, reader_enums_1.isMangaVerticalMode)(reader_enums_1.MangaScrollingMode.Vertical)).toBe(true);
        expect((0, reader_enums_1.isMangaVerticalMode)(reader_enums_1.MangaScrollingMode.VerticalDual)).toBe(true);
        expect((0, reader_enums_1.isMangaVerticalMode)(reader_enums_1.MangaScrollingMode.Horizontal)).toBe(false);
    });
    it('detects long strip modes', () => {
        expect((0, reader_enums_1.isMangaLongStripMode)(reader_enums_1.MangaScrollingMode.LongStrip)).toBe(true);
        expect((0, reader_enums_1.isMangaLongStripMode)(reader_enums_1.MangaScrollingMode.LongStripGap)).toBe(true);
        expect((0, reader_enums_1.isMangaLongStripMode)(reader_enums_1.MangaScrollingMode.Vertical)).toBe(false);
    });
});
