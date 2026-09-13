import { BaseEntity } from '../interfaces/base-entity.model';

export interface Tag extends BaseEntity<number> {
  id?: number;
  name: string;
}
