/**
 * Legacy Android export/import DB stubs — not used by cloud ShareMark sync.
 * Cloud payloads live in share-item.model.ts.
 */
import { BaseEntity } from '../interfaces/base-entity.model';

export interface SharingExportItem extends BaseEntity<number> {
  title: string;
  type: string;
  payload: string;
  dateCreated: string;
}

export interface SharingSyncRecord extends BaseEntity<number> {
  fkId: number;
  type: string;
  cloudProvider: string;
  syncedAt?: string;
}
