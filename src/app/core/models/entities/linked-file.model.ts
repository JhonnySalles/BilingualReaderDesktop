import { BaseEntity } from '../interfaces/base-entity.model';
import { PageLinkType } from '../enums/annotation-enums';

export interface LinkedFile extends BaseEntity<number> {
  sourcePath: string;
  targetPath: string;
  description?: string;
}

export interface LinkedPage extends BaseEntity<number> {
  fkLinkedFile: number;
  sourcePage: number;
  targetPage: number;
  linkType: PageLinkType;
}
