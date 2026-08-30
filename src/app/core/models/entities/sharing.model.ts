import { BaseEntity } from '../interfaces/base-entity.model';
import { ShareMarkType, ShareMarkCloud } from '../enums/annotation-enums';

export interface ShareItem extends BaseEntity<number> {
  title: string;
  type: string;
  payload: string;
  dateCreated: string;
}

export interface ShareMark extends BaseEntity<number> {
  fkId: number;
  type: ShareMarkType;
  cloudProvider: ShareMarkCloud;
  syncedAt?: string;
}

export interface ShareAnnotation extends BaseEntity<number> {
  fkShareItem: number;
  note: string;
}

export interface ShareHistory extends BaseEntity<number> {
  fkShareItem: number;
  syncedDate: string;
}
