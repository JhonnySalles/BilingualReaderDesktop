export enum ShareMarkCloud {
  GOOGLE_DRIVE = 'GOOGLE_DRIVE',
  FIRESTORE = 'FIRESTORE'
}

export enum ShareMarkType {
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
  ERROR_DOWNLOAD = 'ERROR_DOWNLOAD',
  ERROR_UPLOAD = 'ERROR_UPLOAD',
  ERROR_NETWORK = 'ERROR_NETWORK',
  NOT_CONNECT_FIREBASE = 'NOT_CONNECT_FIREBASE',
  NOT_CONNECT_GDRIVE = 'NOT_CONNECT_GDRIVE',
  NOT_CONNECT_DRIVE = 'NOT_CONNECT_DRIVE',
  NOT_ALTERATION = 'NOT_ALTERATION',
  NOT_SIGN_IN = 'NOT_SIGN_IN',
  NEED_PERMISSION_DRIVE = 'NEED_PERMISSION_DRIVE',
  SYNC_IN_PROGRESS = 'SYNC_IN_PROGRESS',
  NOTIFY_DATA_SET = 'NOTIFY_DATA_SET'
}

export class ShareMarkStatus {
  public static send = 0;
  public static receive = 0;

  public static clear(): void {
    ShareMarkStatus.send = 0;
    ShareMarkStatus.receive = 0;
  }
}
