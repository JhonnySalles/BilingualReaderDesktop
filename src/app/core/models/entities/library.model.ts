import { BaseEntity } from '../interfaces/base-entity.model';
import { Libraries } from '../enums/app-enums';

export interface Library extends BaseEntity<number> {
  title: string;
  path: string;
  type: Libraries;
  dateCreate?: string;
  lastAccess?: string;
}
