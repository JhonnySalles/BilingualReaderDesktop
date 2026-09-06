"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LibraryViewType = exports.OrderType = void 0;
// Interfaces Base
__exportStar(require("./interfaces/base-entity.model"), exports);
// Enums
__exportStar(require("./enums/app-enums"), exports);
__exportStar(require("./enums/reader-enums"), exports);
__exportStar(require("./enums/annotation-enums"), exports);
__exportStar(require("./enums/ai-enums"), exports);
// Entities
__exportStar(require("./entities/book.model"), exports);
__exportStar(require("./entities/manga.model"), exports);
__exportStar(require("./entities/annotation.model"), exports);
__exportStar(require("./entities/subtitle.model"), exports);
__exportStar(require("./entities/vocabulary.model"), exports);
__exportStar(require("./entities/history.model"), exports);
__exportStar(require("./entities/comic-info.model"), exports);
__exportStar(require("./entities/sharing.model"), exports);
__exportStar(require("./entities/linked-file.model"), exports);
__exportStar(require("./entities/information.model"), exports);
__exportStar(require("./entities/library.model"), exports);
// Aliases
var app_enums_1 = require("./enums/app-enums");
Object.defineProperty(exports, "OrderType", { enumerable: true, get: function () { return app_enums_1.Order; } });
var reader_enums_1 = require("./enums/reader-enums");
Object.defineProperty(exports, "LibraryViewType", { enumerable: true, get: function () { return reader_enums_1.LibraryMangaType; } });
