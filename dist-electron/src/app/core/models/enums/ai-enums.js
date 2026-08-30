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
var TextSpeech;
(function (TextSpeech) {
    TextSpeech["OFF"] = "OFF";
    TextSpeech["SYSTEM_TTS"] = "SYSTEM_TTS";
    TextSpeech["ONLINE_TTS"] = "ONLINE_TTS";
})(TextSpeech || (exports.TextSpeech = TextSpeech = {}));
var AudioStatus;
(function (AudioStatus) {
    AudioStatus["IDLE"] = "IDLE";
    AudioStatus["PLAYING"] = "PLAYING";
    AudioStatus["PAUSED"] = "PAUSED";
    AudioStatus["STOPPED"] = "STOPPED";
    AudioStatus["ERROR"] = "ERROR";
})(AudioStatus || (exports.AudioStatus = AudioStatus = {}));
