"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudioStatus = exports.TextSpeech = exports.LlmUse = exports.LLM_MANGA_MODEL_OPTIONS = exports.LlmProvider = exports.AssistantMessage = void 0;
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
    LlmProvider["LM_STUDIO"] = "LM_STUDIO";
    LlmProvider["CLAUDE"] = "CLAUDE";
    LlmProvider["DEEPSEEK"] = "DEEPSEEK";
    LlmProvider["OPENROUTER"] = "OPENROUTER";
})(LlmProvider || (exports.LlmProvider = LlmProvider = {}));
exports.LLM_MANGA_MODEL_OPTIONS = [
    'openrouter/free',
    'google/gemini-2.5-flash',
    'anthropic/claude-3.5-sonnet',
    'openai/gpt-4o-mini',
    'deepseek/deepseek-chat'
];
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
