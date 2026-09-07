"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShareMarkStatus = exports.ShareMarkType = exports.ShareMarkCloud = void 0;
var ShareMarkCloud;
(function (ShareMarkCloud) {
    ShareMarkCloud["GOOGLE_DRIVE"] = "GOOGLE_DRIVE";
    ShareMarkCloud["FIRESTORE"] = "FIRESTORE";
})(ShareMarkCloud || (exports.ShareMarkCloud = ShareMarkCloud = {}));
var ShareMarkType;
(function (ShareMarkType) {
    ShareMarkType["SUCCESS"] = "SUCCESS";
    ShareMarkType["ERROR"] = "ERROR";
    ShareMarkType["ERROR_DOWNLOAD"] = "ERROR_DOWNLOAD";
    ShareMarkType["ERROR_UPLOAD"] = "ERROR_UPLOAD";
    ShareMarkType["ERROR_NETWORK"] = "ERROR_NETWORK";
    ShareMarkType["NOT_CONNECT_FIREBASE"] = "NOT_CONNECT_FIREBASE";
    ShareMarkType["NOT_CONNECT_GDRIVE"] = "NOT_CONNECT_GDRIVE";
    ShareMarkType["NOT_CONNECT_DRIVE"] = "NOT_CONNECT_DRIVE";
    ShareMarkType["NOT_ALTERATION"] = "NOT_ALTERATION";
    ShareMarkType["NOT_SIGN_IN"] = "NOT_SIGN_IN";
    ShareMarkType["NEED_PERMISSION_DRIVE"] = "NEED_PERMISSION_DRIVE";
    ShareMarkType["SYNC_IN_PROGRESS"] = "SYNC_IN_PROGRESS";
    ShareMarkType["NOTIFY_DATA_SET"] = "NOTIFY_DATA_SET";
})(ShareMarkType || (exports.ShareMarkType = ShareMarkType = {}));
class ShareMarkStatus {
    static send = 0;
    static receive = 0;
    static clear() {
        ShareMarkStatus.send = 0;
        ShareMarkStatus.receive = 0;
    }
}
exports.ShareMarkStatus = ShareMarkStatus;
