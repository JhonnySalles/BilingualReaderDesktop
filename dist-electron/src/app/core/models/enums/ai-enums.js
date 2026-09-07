"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudioStatus = exports.TextSpeech = exports.LlmUse = exports.LlmProvider = exports.AssistantMessage = void 0;
var AssistantMessage;
(function (AssistantMessage) {
    AssistantMessage["SYSTEM"] = "SYSTEM";
    AssistantMessage["USER"] = "USER";
    AssistantMessage["ASSISTANT"] = "ASSISTANT";
})(AssistantMessage || (exports.AssistantMessage = AssistantMessage = {}));
var LlmProvider;
(function (LlmProvider) {
    LlmProvider["OPENAI"] = "OPENAI";
    LlmProvider["GEMINI"] = "GEMINI";
    LlmProvider["OLLAMA"] = "OLLAMA";
    LlmProvider["CLAUDE"] = "CLAUDE";
    LlmProvider["DEEPSEEK"] = "DEEPSEEK";
})(LlmProvider || (exports.LlmProvider = LlmProvider = {}));
var LlmUse;
(function (LlmUse) {
    LlmUse["TRANSLATION"] = "TRANSLATION";
    LlmUse["EXPLANATION"] = "EXPLANATION";
    LlmUse["DICTIONARY"] = "DICTIONARY";
    LlmUse["CHAT"] = "CHAT";
})(LlmUse || (exports.LlmUse = LlmUse = {}));
var tts_enums_1 = require("./tts-enums");
Object.defineProperty(exports, "TextSpeech", { enumerable: true, get: function () { return tts_enums_1.TextSpeech; } });
Object.defineProperty(exports, "AudioStatus", { enumerable: true, get: function () { return tts_enums_1.AudioStatus; } });
