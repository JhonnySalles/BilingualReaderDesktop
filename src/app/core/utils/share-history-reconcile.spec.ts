import { reconcileHistorySession, LocalHistoryLike } from './share-history-reconcile';
import { ShareHistory } from '../models/entities/share-item.model';

describe('share-history-reconcile', () => {
  const createLocal = (overrides: Partial<LocalHistoryLike> = {}): LocalHistoryLike => ({
    id: 1,
    page_start: 1,
    page_end: 10,
    pages: 100,
    completed: 0,
    volume: 'Vol 1',
    chapters_read: 1,
    date_time_start: '2026-09-10T10:00:00.000Z',
    date_time_end: '2026-09-10T10:30:00.000Z',
    seconds_read: 0,
    average_time_page: 0,
    use_tts: 0,
    ...overrides
  });

  const createCloud = (overrides: Partial<ShareHistory> = {}): ShareHistory => ({
    pageStart: 1,
    pageEnd: 10,
    pages: 100,
    completed: false,
    volume: 'Vol 1',
    chaptersRead: 1,
    start: '2026-09-10T10:00:00.000Z',
    end: '2026-09-10T10:30:00.000Z',
    secondsRead: 0,
    averageTimeByPage: 0,
    useTTS: false,
    ...overrides
  });

  it('should preserve local recalculated secondsRead when cloud has 0 and flag for cloud upload', () => {
    const local = createLocal({ seconds_read: 300, average_time_page: 30 });
    const cloud = createCloud({ secondsRead: 0, averageTimeByPage: 0 });

    const result = reconcileHistorySession(local, cloud);

    expect(result.localChanged).toBe(false);
    expect(result.needsCloudUpload).toBe(true);
    expect(result.localUpdate).toBeUndefined();
  });

  it('should update local when cloud has higher secondsRead', () => {
    const local = createLocal({ seconds_read: 100, average_time_page: 10 });
    const cloud = createCloud({ secondsRead: 500, averageTimeByPage: 50 });

    const result = reconcileHistorySession(local, cloud);

    expect(result.localChanged).toBe(true);
    expect(result.needsCloudUpload).toBe(false);
    expect(result.localUpdate).toBeDefined();
    expect(result.localUpdate?.secondsRead).toBe(500);
    expect(result.localUpdate?.averageTimeByPage).toBe(50);
  });

  it('should update local when cloud has more page progress', () => {
    const local = createLocal({ page_end: 10, completed: 0 });
    const cloud = createCloud({ pageEnd: 50, completed: false });

    const result = reconcileHistorySession(local, cloud);

    expect(result.localChanged).toBe(true);
    expect(result.localUpdate?.pageEnd).toBe(50);
  });

  it('should flag cloud upload when local has more page progress', () => {
    const local = createLocal({ page_end: 50, completed: 0 });
    const cloud = createCloud({ pageEnd: 10, completed: false });

    const result = reconcileHistorySession(local, cloud);

    expect(result.localChanged).toBe(false);
    expect(result.needsCloudUpload).toBe(true);
  });

  it('should take completed status if either local or cloud is completed', () => {
    const local = createLocal({ completed: 0, page_end: 100, pages: 100 });
    const cloud = createCloud({ completed: true });

    const result = reconcileHistorySession(local, cloud);

    expect(result.localChanged).toBe(true);
    expect(result.localUpdate?.completed).toBe(true);
  });
});
