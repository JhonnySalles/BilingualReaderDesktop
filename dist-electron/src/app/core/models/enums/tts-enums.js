"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudioStatus = exports.TEXT_SPEECH_CATALOG = exports.TextSpeech = void 0;
exports.activeTextSpeechVoices = activeTextSpeechVoices;
exports.textSpeechDefault = textSpeechDefault;
exports.parseTextSpeech = parseTextSpeech;
exports.textSpeechAzureName = textSpeechAzureName;
exports.ttsRateToEdge = ttsRateToEdge;
exports.formatTtsSpeedLabel = formatTtsSpeedLabel;
const app_enums_1 = require("./app-enums");
/** Neural Edge / Azure voice catalog (Android TextSpeech parity). */
var TextSpeech;
(function (TextSpeech) {
    TextSpeech["ARIA"] = "ARIA";
    TextSpeech["GUY"] = "GUY";
    TextSpeech["JENNY"] = "JENNY";
    TextSpeech["NANAMI"] = "NANAMI";
    TextSpeech["KEITA"] = "KEITA";
    TextSpeech["FRANCISCA"] = "FRANCISCA";
    TextSpeech["ANTONIO"] = "ANTONIO";
})(TextSpeech || (exports.TextSpeech = TextSpeech = {}));
exports.TEXT_SPEECH_CATALOG = {
    [TextSpeech.ARIA]: {
        id: TextSpeech.ARIA,
        azureName: 'en-US-AriaNeural',
        language: app_enums_1.Languages.ENGLISH,
        label: 'Aria (EN · feminino)',
        gender: 'feminine',
        active: true
    },
    [TextSpeech.GUY]: {
        id: TextSpeech.GUY,
        azureName: 'en-US-GuyNeural',
        language: app_enums_1.Languages.ENGLISH,
        label: 'Guy (EN · masculino)',
        gender: 'masculine',
        active: true
    },
    [TextSpeech.JENNY]: {
        id: TextSpeech.JENNY,
        azureName: 'en-US-JennyNeural',
        language: app_enums_1.Languages.ENGLISH,
        label: 'Jenny (EN · feminino)',
        gender: 'feminine',
        active: true
    },
    [TextSpeech.NANAMI]: {
        id: TextSpeech.NANAMI,
        azureName: 'ja-JP-NanamiNeural',
        language: app_enums_1.Languages.JAPANESE,
        label: 'Nanami (JA · feminino)',
        gender: 'feminine',
        active: true
    },
    [TextSpeech.KEITA]: {
        id: TextSpeech.KEITA,
        azureName: 'ja-JP-KeitaNeural',
        language: app_enums_1.Languages.JAPANESE,
        label: 'Keita (JA · masculino)',
        gender: 'masculine',
        active: true
    },
    [TextSpeech.FRANCISCA]: {
        id: TextSpeech.FRANCISCA,
        azureName: 'pt-BR-FranciscaNeural',
        language: app_enums_1.Languages.PORTUGUESE,
        label: 'Francisca (PT · feminino)',
        gender: 'feminine',
        active: true
    },
    [TextSpeech.ANTONIO]: {
        id: TextSpeech.ANTONIO,
        azureName: 'pt-BR-AntonioNeural',
        language: app_enums_1.Languages.PORTUGUESE,
        label: 'Antonio (PT · masculino)',
        gender: 'masculine',
        active: true
    }
};
function activeTextSpeechVoices() {
    return Object.values(exports.TEXT_SPEECH_CATALOG).filter(v => v.active);
}
function textSpeechDefault(isJapanese) {
    return isJapanese ? TextSpeech.NANAMI : TextSpeech.FRANCISCA;
}
function parseTextSpeech(value, fallback) {
    if (typeof value !== 'string')
        return fallback;
    return Object.values(TextSpeech).includes(value)
        ? value
        : fallback;
}
function textSpeechAzureName(id) {
    return exports.TEXT_SPEECH_CATALOG[id]?.azureName ?? exports.TEXT_SPEECH_CATALOG[TextSpeech.FRANCISCA].azureName;
}
/** Edge rate string from Android-style −50…+50 slider. */
function ttsRateToEdge(rate) {
    const n = Math.max(-50, Math.min(50, Math.round(rate / 5) * 5));
    return n >= 0 ? `+${n}%` : `${n}%`;
}
function formatTtsSpeedLabel(rate) {
    const n = Math.max(-50, Math.min(50, Math.round(Number(rate) || 0)));
    return n >= 0 ? `+${n}%` : `${n}%`;
}
var AudioStatus;
(function (AudioStatus) {
    AudioStatus["PREPARE"] = "PREPARE";
    AudioStatus["PLAY"] = "PLAY";
    AudioStatus["PAUSE"] = "PAUSE";
    AudioStatus["STOP"] = "STOP";
    AudioStatus["ENDING"] = "ENDING";
    AudioStatus["ERROR"] = "ERROR";
})(AudioStatus || (exports.AudioStatus = AudioStatus = {}));
