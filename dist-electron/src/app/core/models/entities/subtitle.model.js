"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeVocabularyWire = normalizeVocabularyWire;
function normalizeVocabularyWire(raw) {
    if (!raw || typeof raw !== 'object')
        return null;
    const word = (raw.palavra || raw.word || '').trim();
    if (!word)
        return null;
    const basicForm = (raw.basicForm || raw.basic_form || word).trim();
    return {
        id: raw.id,
        word,
        basicForm,
        reading: (raw.leitura || raw.reading || '').trim(),
        english: (raw.ingles || raw.english || '').trim(),
        portuguese: (raw.portugues || raw.portuguese || '').trim(),
        jlpt: raw.jlpt != null ? String(raw.jlpt) : '',
        revised: raw.revisado ?? raw.revised ?? false,
        favorite: raw.favorite ?? false,
        appears: raw.appears ?? 0
    };
}
