# Custom Models (All Providers) for SillyTavern

![License](https://img.shields.io/badge/license-MIT-green) ![ST](https://img.shields.io/badge/SillyTavern-1.18.x%20tested-blue)

A maintained fork of the [SillyTavern-CustomModels](https://github.com/LenAnderson/SillyTavern-CustomModels) extension by **LenAnderson**, which lets you add custom model IDs to the model selection dropdowns of nearly every chat-completion API provider in SillyTavern.

> **Current maintainer / this fork:** [wul7chaos](https://github.com/wul7chaos/SillyTavern-CustomModels-All-Providers)
> **Fork lineage:** LenAnderson (original) → [zhongruichen](https://github.com/zhongruichen/SillyTavern-CustomModels-All-Providers) ("All Providers" fork) → **wul7chaos** (ST 1.18 compatibility fix, v1.4.0)

All credit for the original idea and core concept goes to LenAnderson. This fork only carries compatibility fixes — see [What changed](#what-changed-in-this-fork).

## Screenshots

| Edit button next to the model dropdown | Custom models editor |
|---|---|
| ![Edit button](README/stcm-01.png) | ![Editor](README/stcm-02.png) |

## What changed in this fork

### v1.4.0 — SillyTavern 1.18 compatibility fix

**Problem:** on ST 1.18 the extension appeared to do nothing — you could click the edit button and save custom model IDs, but they never showed up in the model dropdown (and on the *Custom* source the button did not even appear).

**Root causes found in ST 1.18:**

1. `openai.js` rebuilds the model dropdowns with `$('.model_custom_select').empty()` on every connect / model-list refresh / preset switch. The old extension injected its `optgroup` **once**, 500 ms after page load — once ST wiped the `<select>`, the group became a detached DOM node and saving wrote options into a node that was no longer in the document.
2. The *Custom (OpenAI-compatible)* source now uses an `input + datalist` ("Enter a Model ID") instead of a plain `<select>`. The old extension never populated that datalist, and its edit-button placement logic (which expects the `<h4>` inside the select's parent) could not find a header for the new layout, so the button was skipped entirely.

**Fixes in v1.4.0 (`index.js`):**

- A **`MutationObserver`** now guards every bound model `<select>`: whenever ST clears/rebuilds it, the *Custom Models* `optgroup` is re-inserted and re-filled automatically (loop-safe, no redundant DOM writes). This applies to **all** providers, not just Custom.
- The **datalist** `#model_custom_select_fill` of the Custom source is observed as well: your custom IDs are injected as suggestions there, merged with the models ST fetched (custom entries are tagged `data-stcm` and pruned when removed from your list).
- **Edit-button placement** now tolerates both the old layout (`<h4>` inside the select's parent) and the new one (`<h4>` as a preceding sibling of the `flex-container`), so the button shows up for the Custom source again.
- One-shot `setTimeout(500)` binding replaced by a small **retry loop**, removing the race with ST's async init.
- Saved model lists are now **trimmed and de-duplicated**; settings format is fully backward compatible (no migration needed).
- Old releases injected the group even when the list was empty, leaving a stray empty "Custom Models" header — an empty list now removes the group instead.

### Earlier (inherited from the "All Providers" fork)

- Support extended from the original three providers to nearly all chat-completion sources: OpenAI, Claude/Anthropic, Google (AI Studio/Vertex), OpenRouter, MistralAI, Cohere, DeepSeek, Groq, Perplexity, Scale, AI21, 01.AI, xAI, NovelAI, KoboldAI, TextGenerationWebUI, Horde, Pollinations, NanoGPT, Together, Moonshot, ZAI, window.ai, Custom (OpenAI-compatible), etc.

## How to install

1. In SillyTavern, open the extensions panel (puzzle-piece icon).
2. Go to the **Download Extension** tab.
3. Paste this repository URL:
   ```
   https://github.com/wul7chaos/SillyTavern-CustomModels-All-Providers.git
   ```
4. Click **Download**, enable the extension in the **Installed** tab, then reload the UI.

> Already installed the old version? Update from the extensions panel (this fork is now the `origin` remote of existing installs that were cloned from it), or simply hard-refresh the browser (Ctrl+F5) after updating — extension scripts are served without a cache-busting version parameter.

## How to use

1. Open the API connection settings and pick your provider, then connect.
2. Next to the model selection dropdown you'll find a new **edit button** (pen icon).
3. Click it and enter your custom model names, **one per line**.
4. Click **Save** — a "Custom Models" group appears at the top of the dropdown (and in the Custom source's "Enter a Model ID" suggestions).
5. Custom models persist per provider in your ST settings and survive reconnects, API switches and page reloads.

> Note: custom model entries are plain IDs the UI lets you pick — the actual API request still goes through the selected provider, so the ID must be valid for that endpoint.

## Compatibility

- Tested against **SillyTavern 1.18.0** (works with the reworked Custom-source UI and the aggressive dropdown rebuilding in `openai.js`).
- Older ST versions (≥ 1.12) should also work; the code falls back to legacy popups on ancient builds.

## Credits & attribution

- **LenAnderson** — author of the original [SillyTavern-CustomModels](https://github.com/LenAnderson/SillyTavern-CustomModels).
- **zhongruichen** — the "All Providers" fork that broadened provider support.
- **wul7chaos** — current fork: ST 1.18 compatibility (v1.4.0), ongoing maintenance.
