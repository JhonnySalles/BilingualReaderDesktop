import {
  ANNOTATION_PAGE_CFI_DIFF_THRESHOLD,
  annotationPageCfiDiffers,
  reconcileAnnotationPageAndCfi,
  scaleAnnotationPageFromCloud
} from './share-annotation-reconcile';
import {
  SHARE_ANNOTATION_FIELDS as AF,
  ShareAnnotation
} from '../models/entities/share-item.model';

describe('scaleAnnotationPageFromCloud', () => {
  it('scales proportionally', () => {
    expect(scaleAnnotationPageFromCloud(50, 100, 200)).toBe(100);
  });

  it('clamps to local pages when at end', () => {
    expect(scaleAnnotationPageFromCloud(100, 100, 200)).toBe(200);
  });

  it('handles zero shared pages', () => {
    expect(scaleAnnotationPageFromCloud(10, 0, 50)).toBe(10);
  });
});

describe('annotationPageCfiDiffers', () => {
  it('uses default threshold of 3', () => {
    expect(ANNOTATION_PAGE_CFI_DIFF_THRESHOLD).toBe(3);
    expect(annotationPageCfiDiffers(10, 12)).toBe(false);
    expect(annotationPageCfiDiffers(10, 13)).toBe(true);
  });
});

describe('reconcileAnnotationPageAndCfi', () => {
  it('fills missing cfi from page', () => {
    const result = reconcileAnnotationPageAndCfi({
      page: 42,
      pages: 100,
      cfiRange: '',
      cfiFromPage: 'epubcfi(/6/4!)',
      localPages: 100
    });
    expect(result.changed).toBe(true);
    expect(result.cfiRange).toBe('epubcfi(/6/4!)');
    expect(result.page).toBe(42);
  });

  it('updates page from cfi when diff >= 3', () => {
    const result = reconcileAnnotationPageAndCfi({
      page: 10,
      pages: 100,
      cfiRange: 'epubcfi(/6/8!)',
      pageFromCfi: 20,
      localPages: 100
    });
    expect(result.changed).toBe(true);
    expect(result.page).toBe(20);
    expect(result.cfiRange).toBe('epubcfi(/6/8!)');
  });

  it('keeps page when diff < 3', () => {
    const result = reconcileAnnotationPageAndCfi({
      page: 10,
      pages: 100,
      cfiRange: 'epubcfi(/6/8!)',
      pageFromCfi: 12,
      localPages: 100
    });
    expect(result.changed).toBe(false);
    expect(result.page).toBe(10);
  });

  it('regenerates cfi when location resolve fails', () => {
    const result = reconcileAnnotationPageAndCfi({
      page: 5,
      pages: 50,
      cfiRange: 'epubcfi(broken)',
      pageFromCfi: null,
      cfiFromPage: 'epubcfi(/6/2!)',
      localPages: 50
    });
    expect(result.changed).toBe(true);
    expect(result.cfiRange).toBe('epubcfi(/6/2!)');
  });
});

describe('ShareAnnotation optional cfiRange wire shape', () => {
  it('omits empty cfiRange from a wire object', () => {
    const a: ShareAnnotation = {
      page: 1,
      pages: 10,
      fontSize: 16,
      type: 'Annotation',
      chapterNumber: 0,
      chapter: '',
      text: 'hi',
      range: '0,2',
      annotation: '',
      favorite: false,
      color: 'Yellow',
      created: new Date().toISOString()
    };
    const wire: Record<string, unknown> = {
      [AF.PAGE]: a.page,
      [AF.PAGES]: a.pages,
      [AF.RANGE]: a.range
    };
    const cfi = (a.cfiRange || '').trim();
    if (cfi) wire[AF.CFI_RANGE] = cfi;
    expect(wire[AF.CFI_RANGE]).toBeUndefined();
  });

  it('includes non-empty cfiRange', () => {
    const a: ShareAnnotation = {
      page: 1,
      pages: 10,
      fontSize: 16,
      type: 'Annotation',
      chapterNumber: 0,
      chapter: '',
      text: 'hi',
      range: '',
      annotation: '',
      favorite: false,
      color: 'Yellow',
      created: new Date().toISOString(),
      cfiRange: 'epubcfi(/6/4!)'
    };
    const wire: Record<string, unknown> = {};
    const cfi = (a.cfiRange || '').trim();
    if (cfi) wire[AF.CFI_RANGE] = cfi;
    expect(wire[AF.CFI_RANGE]).toBe('epubcfi(/6/4!)');
  });
});
