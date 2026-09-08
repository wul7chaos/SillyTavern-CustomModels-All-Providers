import { saveSettingsDebounced } from '../../../../script.js';
import { extension_settings } from '../../../extensions.js';

const supportedProviders = [
    'openai', 'claude', 'windowai', 'aimlapi', 'openrouter', 'ai21', 'scale',
    'makersuite', 'vertexai', 'mistralai', 'custom', 'cohere', 'perplexity',
    'groq', '01ai', 'nanogpt', 'deepseek', 'xai', 'pollinations', 'novelai',
    'koboldai', 'textgenerationwebui', 'horde', 'anthropic', 'together',
];

const defaultSettings = { provider: {} };
for (const provider of supportedProviders) {
    defaultSettings.provider[provider] = [];
    defaultSettings[`${provider}_model`] = undefined;
}

const settings = { ...defaultSettings };
Object.assign(settings, extension_settings.customModels ?? {});

// Fix for settings from older versions
for (const provider of supportedProviders) {
    if (!settings.provider[provider]) {
        settings.provider[provider] = [];
    }
}

// old popups, ancient ST
let popupCaller;
let popupType;
let popupResult;
try {
    const popup = await import('../../../popup.js');
    popupCaller = popup.callGenericPopup;
    popupType = popup.POPUP_TYPE;
    popupResult = popup.POPUP_RESULT;
} catch {
    popupCaller = (await import('../../../../script.js')).callPopup;
    popupType = {
        TEXT: 1,
    };
    popupResult = {
        AFFIRMATIVE: 1,
    };
}

const LOG = (...args) => console.debug('[CustomModels]', ...args);

// ST (>=1.12/1.13) rebuilds model selects/datalists with `.empty()` + re-append
// on every connect / model-list refresh / preset switch, which used to destroy
// this extension's optgroup. We now keep re-injecting it via MutationObserver.

/**
 * Find the heading that belongs to the model select, tolerating both layouts:
 * - old: <div><h4/><select/></div>  (h4 inside select.parentElement)
 * - new: <h4/><div class="flex-container"><select/></div>  (h4 is a preceding sibling)
 */
function findHeader(sel) {
    let h4 = sel.parentElement?.querySelector('h4') ?? null;
    if (h4) return h4;
    const anchor = sel.closest('.flex-container') ?? sel.parentElement;
    let el = anchor?.previousElementSibling ?? null;
    while (el) {
        if (el.tagName === 'H4') return el;
        el = el.previousElementSibling;
    }
    return null;
}

/**
 * Re-insert the "Custom Models" optgroup into the select and sync its options.
 * Loop-safe: does not touch the DOM when the state already matches.
 */
function syncGroup(state) {
    const { sel, grp, models } = state;
    if (!models.length) {
        if (grp.isConnected) grp.remove();
        return;
    }
    if (grp.parentElement !== sel) {
        sel.insertBefore(grp, sel.firstChild);
    }
    const current = [...grp.children].map(o => o.value).join('\n');
    const want = models.join('\n');
    if (current !== want) {
        grp.innerHTML = '';
        for (const model of models) {
            const opt = document.createElement('option');
            opt.value = model;
            opt.textContent = model;
            grp.append(opt);
        }
    }
}

/**
 * Custom source (ST >= 1.13): the "Enter a Model ID" input takes suggestions
 * from the datalist #model_custom_select_fill, which ST also wipes and
 * refills. Add our models as plain <option> entries there without touching
 * the models ST fetched.
 */
function syncDatalist(state) {
    const dl = state.datalist;
    if (!dl) return;
    dl.querySelectorAll('option[data-stcm]').forEach(o => {
        if (!state.models.includes(o.value)) o.remove();
    });
    const existing = new Set([...dl.querySelectorAll('option')].map(o => o.value));
    const missing = state.models.filter(m => !existing.has(m));
    for (const model of missing) {
        const opt = document.createElement('option');
        opt.value = model;
        opt.dataset.stcm = '1';
        dl.append(opt);
    }
}

const bound = new Map(); // provider -> state

function bindProvider(provider) {
    if (bound.has(provider)) return true;
    const models = settings.provider[provider];
    const sel = /**@type {HTMLSelectElement}*/(document.querySelector(`#model_${provider}_select`));
    if (!sel) return false;

    const state = { sel, models, grp: null, datalist: null };
    const grp = document.createElement('optgroup');
    grp.label = 'Custom Models';
    state.grp = grp;

    const h4 = findHeader(sel);
    if (h4) {
        const btn = document.createElement('div');
        btn.classList.add('stcm--btn');
        btn.classList.add('menu_button');
        btn.classList.add('fa-solid', 'fa-fw', 'fa-pen-to-square');
        btn.title = 'Edit custom models';
        btn.addEventListener('click', async () => {
            let inp;
            const dom = document.createElement('div');
            {
                const header = document.createElement('h3');
                header.textContent = `Custom Models: ${provider}`;
                dom.append(header);
            }
            const hint = document.createElement('small');
            hint.textContent = 'one model name per line';
            dom.append(hint);
            inp = document.createElement('textarea');
            {
                inp.classList.add('text_pole');
                inp.rows = 20;
                inp.value = models.join('\n');
                dom.append(inp);
            }
            const prom = popupCaller(dom, popupType.TEXT, null, { okButton: 'Save' });
            const result = await prom;
            if (result == popupResult.AFFIRMATIVE) {
                const next = [...new Set(inp.value.split('\n').map(it => it.trim()).filter(it => it.length))];
                models.length = 0;
                models.push(...next);
                extension_settings.customModels = settings;
                saveSettingsDebounced();
                syncGroup(state);
                syncDatalist(state);
                if (settings[`${provider}_model`] && models.includes(settings[`${provider}_model`])) {
                    sel.value = settings[`${provider}_model`];
                    sel.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
        });
        h4.append(btn);
    } else {
        LOG(`no header found for provider "${provider}", edit button skipped`);
    }

    syncGroup(state);
    new MutationObserver(() => syncGroup(state)).observe(sel, { childList: true });
    bound.set(provider, state);

    if (provider === 'custom') {
        const dl = document.querySelector('#model_custom_select_fill');
        if (dl) {
            state.datalist = dl;
            syncDatalist(state);
            new MutationObserver(() => syncDatalist(state)).observe(dl, { childList: true });
        }
    }

    if (settings[`${provider}_model`] && models.includes(settings[`${provider}_model`])) {
        sel.value = settings[`${provider}_model`];
        sel.dispatchEvent(new Event('change', { bubbles: true }));
    }
    sel.addEventListener('change', (evt) => {
        evt.stopImmediatePropagation();
        if (settings[`${provider}_model`] != sel.value) {
            settings[`${provider}_model`] = sel.value;
            extension_settings.customModels = settings;
            saveSettingsDebounced();
        }
    });

    LOG(`bound "${provider}" (${models.length} custom model(s))`);
    return true;
}

function init() {
    const pending = new Set(Object.keys(settings.provider));
    const tryBindAll = () => {
        for (const provider of [...pending]) {
            if (bindProvider(provider)) pending.delete(provider);
        }
        return pending.size === 0;
    };
    if (tryBindAll()) return;
    // Some selects may not exist (renamed providers) or may be added late; retry
    const iv = setInterval(() => {
        if (tryBindAll()) clearInterval(iv);
    }, 300);
    setTimeout(() => {
        clearInterval(iv);
        if (pending.size) LOG('providers without a matching select element:', [...pending].join(', '));
    }, 30000);
}

init();
