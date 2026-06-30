'use strict';
/**
 * translationService — Google Cloud Translation v2 client.
 *
 * Uses Application Default Credentials (ADC), so no explicit
 * GOOGLE_APPLICATION_CREDENTIALS env var is required when the
 * credentials live in any of the standard locations the GCP client
 * checks:
 *   - $GOOGLE_APPLICATION_CREDENTIALS (service-account JSON file)
 *   - ~/.config/gcloud/application_default_credentials.json (gcloud ADC)
 *   - GKE / GCE / Cloud Run metadata server
 *
 * The route is fail-fast: if no client can be initialized (no
 * credentials anywhere in the chain) the service throws — the
 * /api/outreach/* routes translate that into a structured 503
 * response so the client can show a meaningful error.
 */
const { Translate } = require('@google-cloud/translate').v2;

let _client = null;
let _initErr = null;

function _client_init() {
    if (_client) return;
    try {
        _client = new Translate({});
    } catch (e) {
        _initErr = e;
        _client = null;
    }
}

try { _client_init(); } catch (e) { _initErr = e; }

// Curated list of languages for the UI dropdown.  Each entry:
//   { code, name, nativeName, region }
//   Ordered by relevance for an Indian retail bank; "en" is omitted
//   from the dropdown (the LLM output is already English).
const SUPPORTED_LANGUAGES = [
    { code: 'hi',    name: 'Hindi',          nativeName: 'हिन्दी',         region: 'India' },
    { code: 'bn',    name: 'Bengali',        nativeName: 'বাংলা',          region: 'India' },
    { code: 'ta',    name: 'Tamil',          nativeName: 'தமிழ்',          region: 'India' },
    { code: 'te',    name: 'Telugu',         nativeName: 'తెలుగు',         region: 'India' },
    { code: 'mr',    name: 'Marathi',        nativeName: 'मराठी',          region: 'India' },
    { code: 'gu',    name: 'Gujarati',       nativeName: 'ગુજરાતી',        region: 'India' },
    { code: 'kn',    name: 'Kannada',        nativeName: 'ಕನ್ನಡ',          region: 'India' },
    { code: 'ml',    name: 'Malayalam',      nativeName: 'മലയാളം',        region: 'India' },
    { code: 'pa',    name: 'Punjabi',        nativeName: 'ਪੰਜਾਬੀ',         region: 'India' },
    { code: 'ur',    name: 'Urdu',           nativeName: 'اُردُو',          region: 'India' },
    { code: 'es',    name: 'Spanish',        nativeName: 'Español',         region: 'Global' },
    { code: 'fr',    name: 'French',         nativeName: 'Français',        region: 'Global' },
    { code: 'de',    name: 'German',         nativeName: 'Deutsch',         region: 'Global' },
    { code: 'pt',    name: 'Portuguese',     nativeName: 'Português',      region: 'Global' },
    { code: 'ar',    name: 'Arabic',         nativeName: 'العربية',         region: 'Global' },
    { code: 'zh',    name: 'Chinese (simp)', nativeName: '简体中文',       region: 'Global' },
    { code: 'ja',    name: 'Japanese',       nativeName: '日本語',           region: 'Global' },
    { code: 'ko',    name: 'Korean',         nativeName: '한국어',          region: 'Global' },
    { code: 'ru',    name: 'Russian',        nativeName: 'Русский',        region: 'Global' },
];

const CODE_TO_META = SUPPORTED_LANGUAGES.reduce((m, l) => { m[l.code] = l; return m; }, {});

function isReady()   { return _client !== null; }
function initError() { return _initErr ? _initErr.message : null; }

function _validateLanguage(code) {
    if (!code) {
        throw Object.assign(new Error('target language is required'),
            { httpStatus: 400 });
    }
    if (code === 'en') return; // source == target → noop below
    if (!CODE_TO_META[code]) {
        throw Object.assign(new Error(`unsupported target language: ${code}`),
            { httpStatus: 400 });
    }
}

async function listLanguages() {
    if (!isReady()) {
        throw Object.assign(new Error(
            'Google Cloud Translation client is not initialized: ' +
            (initError() || 'no credentials found in the ADC chain. ' +
             'Run `gcloud auth application-default login` or set ' +
             'GOOGLE_APPLICATION_CREDENTIALS to a service-account JSON file.')),
            { httpStatus: 503, stage: 5, stage_name: 'translation' }
        );
    }
    const [codes] = await _client.getLanguages();
    return {
        mode: 'gcp',
        project: process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'gcp-adc',
        languages: codes.map(c => {
            const meta = CODE_TO_META[c.code] || {};
            return {
                code: c.code,
                name: c.name || meta.name || c.code,
                nativeName: meta.nativeName || '',
                region:     meta.region     || 'Global',
            };
        }),
    };
}

/**
 * Translate every translatable field in `herald` to `target` via
 * the GCP Translation v2 API.  Throws on init / API error — the
 * route layer turns it into a structured 502/503.
 */
async function translateContent({ herald, target, source = 'en' }) {
    if (!herald) {
        throw Object.assign(new Error('herald content is required'),
            { httpStatus: 400 });
    }
    _validateLanguage(target);
    if (target === source) {
        const out = JSON.parse(JSON.stringify(herald));
        out.metadata = { ...(out.metadata || {}), source_language: source, target_language: target, translated_at: new Date().toISOString() };
        return { mode: 'noop', source, target, herald: out };
    }
    if (!isReady()) {
        throw Object.assign(new Error(
            'Google Cloud Translation client is not initialized: ' +
            (initError() || 'no credentials found in the ADC chain.')),
            { httpStatus: 503, stage: 5, stage_name: 'translation' }
        );
    }

    const fields = [
        herald.email?.subject,
        herald.email?.body,
        herald.sms?.body,
        herald.push?.title,
        herald.push?.body,
    ].filter(v => typeof v === 'string' && v.trim().length > 0);

    if (fields.length === 0) {
        return { mode: 'noop', source, target, herald };
    }

    const [translations] = await _client.translate(fields, target);
    // GCP returns the translations in the same order as `fields`.
    let i = 0;
    const out = JSON.parse(JSON.stringify(herald));
    if (out.email?.subject) { out.email.subject = translations[i++]; }
    if (out.email?.body)    { out.email.body    = translations[i++]; }
    if (out.sms?.body)      { out.sms.body      = translations[i++]; }
    if (out.push?.title)    { out.push.title    = translations[i++]; }
    if (out.push?.body)     { out.push.body     = translations[i++]; }
    out.metadata = { ...(out.metadata || {}), source_language: source, target_language: target, translated_at: new Date().toISOString() };
    return {
        mode: 'gcp',
        source, target,
        herald: out,
        project: process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'gcp-adc',
    };
}

/**
 * Generic-content API used by the legacy /api/outreach/translate
 * route.  Translates any object with the {email:{subject,body},
 * sms:{body}, push:{title,body}} shape.
 */
async function translateOutreach(content, target, firstName) {
    if (!content) {
        throw Object.assign(new Error('content is required'),
            { httpStatus: 400 });
    }
    _validateLanguage(target);
    if (target === 'en') {
        const out = JSON.parse(JSON.stringify(content));
        return { mode: 'noop', target_language: target, content: out, first_name: firstName };
    }
    if (!isReady()) {
        throw Object.assign(new Error(
            'Google Cloud Translation client is not initialized: ' +
            (initError() || 'no credentials found in the ADC chain.')),
            { httpStatus: 503, stage: 5, stage_name: 'translation' }
        );
    }

    const fields = [
        content.email?.subject,
        content.email?.body,
        content.sms?.body,
        content.push?.title,
        content.push?.body,
    ].filter(v => typeof v === 'string' && v.trim().length > 0);

    if (fields.length === 0) {
        return { mode: 'noop', target_language: target, content, first_name: firstName };
    }

    const [translations] = await _client.translate(fields, target);
    let i = 0;
    const out = JSON.parse(JSON.stringify(content));
    if (out.email?.subject) out.email.subject = translations[i++];
    if (out.email?.body)    out.email.body    = translations[i++];
    if (out.sms?.body)      out.sms.body      = translations[i++];
    if (out.push?.title)    out.push.title    = translations[i++];
    if (out.push?.body)     out.push.body     = translations[i++];
    out.metadata = { ...(out.metadata || {}), target_language: target, source_language: 'en', translated_at: new Date().toISOString() };
    return {
        mode: 'gcp',
        target_language: target,
        content: out,
        first_name: firstName,
        project: process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'gcp-adc',
    };
}

module.exports = {
    listLanguages,
    translateContent,
    translateOutreach,
    isReady,
    initError,
    SUPPORTED_LANGUAGES,
};
