export enum ShareMarkCloud {
  GOOGLE_DRIVE = 'GOOGLE_DRIVE',
  FIRESTORE = 'FIRESTORE'
}

export enum ShareMarkType {
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
  ERROR_DOWNLOAD = 'ERROR_DOWNLOAD',
  ERROR_UPLOAD = 'ERROR_UPLOAD',
  NOT_CONNECT_FIREBASE = 'NOT_CONNECT_FIREBASE',
  NOT_CONNECT_GDRIVE = 'NOT_CONNECT_GDRIVE',
  NOT_ALTERATION = 'NOT_ALTERATION'
}

export class ShareMarkStatus {
  public static send = 0;
  public static receive = 0;

  public static clear(): void {
    ShareMarkStatus.send = 0;
    ShareMarkStatus.receive = 0;
  }
}
