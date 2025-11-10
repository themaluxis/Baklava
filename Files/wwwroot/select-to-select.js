/*
 * select-to-select.js
 * Alternate UI: use <select> dropdowns instead of card carousels.
 * This file provides a small toggle to switch display modes and keeps
 * the native selects visible when 'selects' mode is chosen.
 * Also displays filename for version select and parses content.
 */
(function () {
    'use strict';

    console.log('[SelectToSelect] Loading alternative select UI...');

    function parseVersionText(text) {
        // Parse version/quality/codec/other metadata from text
        const lines = text.split('\n').map(l => l.trim()).filter(l => l);
        const parsed = {
            version: '',
            quality: '',
            codec: '',
            audio: '',
            size: '',
            languages: '',
            filename: ''
        };
        
        lines.forEach(line => {
            // Look for quality indicators
            if (/\b(2160p|1080p|720p|480p|4K|Unknown)\b/i.test(line)) {
                const match = line.match(/\b(2160p|1080p|720p|480p|4K|Unknown)\b/i);
                if (match) parsed.quality = match[1];
            }
            // Look for codecs
            if (/\b(HEVC|H\.?265|H\.?264|X264|X265|AVC)\b/i.test(line)) {
                const codecs = line.match(/\b(HEVC|H\.?265|H\.?264|X264|X265|AVC)\b/gi);
                if (codecs) parsed.codec = codecs.join(' ');
            }
            // Look for video format
            if (/\b(WEB-DL|BLURAY|WEB|HDR|DV|Dolby Vision)\b/i.test(line)) {
                const formats = line.match(/\b(WEB-DL|BLURAY|WEB|HDR|DV|Dolby Vision)\b/gi);
                if (formats) parsed.version = formats.join(' ');
            }
            // Look for audio
            if (/\b(Atmos|DD\+|DD|DTS|AAC|5\.1|7\.1|2\.0)\b/i.test(line)) {
                const audio = line.match(/\b(Atmos|DD\+|DD|DTS|AAC|5\.1|7\.1|2\.0)\b/gi);
                if (audio) parsed.audio = audio.join(' ');
            }
            // Look for size
            if (/\b(\d+\.?\d*\s*(?:GB|MB|TB))\b/i.test(line)) {
                const match = line.match(/\b(\d+\.?\d*\s*(?:GB|MB|TB))\b/i);
                if (match) parsed.size = match[1];
            }
            // Look for languages
            if (/\b(English|Spanish|French|German|Italian|Japanese|Korean|Chinese|Latino|Multi)\b/i.test(line)) {
                const langs = line.match(/\b(English|Spanish|French|German|Italian|Japanese|Korean|Chinese|Latino|Multi)\b/gi);
                if (langs) parsed.languages = langs.join(' | ');
            }
            // Filename is usually the last line with extension
            if (/\.(mkv|mp4|avi|mov|m4v)$/i.test(line)) {
                parsed.filename = line;
            }
        });
        
        return parsed;
    }

    function formatSelectOption(text) {
        const parsed = parseVersionText(text);
        let formatted = '';
        
        if (parsed.quality) formatted += `${parsed.quality} `;
        if (parsed.version) formatted += `${parsed.version} `;
        if (parsed.codec) formatted += `${parsed.codec} `;
        if (parsed.audio) formatted += `🎧 ${parsed.audio} `;
        if (parsed.size) formatted += `📦 ${parsed.size} `;
        if (parsed.languages) formatted += `🌎 ${parsed.languages}`;
        
        return formatted.trim() || text;
    }

    function enhanceSelects() {
        // Find version select and add filename display
        const versionSelect = document.querySelector('select#selectMediaSource');
        if (versionSelect && !versionSelect._enhanced) {
            versionSelect._enhanced = true;
            
            // Create filename display above select
            const filenameDiv = document.createElement('div');
            filenameDiv.className = 'sts-filename';
            filenameDiv.style.cssText = `
                margin-bottom: 8px;
                padding: 8px 12px;
                background: rgba(0,0,0,0.3);
                border-radius: 4px;
                color: rgba(255,255,255,0.6);
                font-size: 12px;
                text-align: center;
                font-family: monospace;
            `;
            
            // Insert before select container
            const container = versionSelect.closest('.selectContainer');
            if (container) {
                container.parentNode.insertBefore(filenameDiv, container);
            }
            
            // Update filename when selection changes
            const updateFilename = () => {
                const selectedOption = versionSelect.options[versionSelect.selectedIndex];
                if (selectedOption) {
                    filenameDiv.textContent = selectedOption.textContent;
                }
            };
            
            updateFilename();
            versionSelect.addEventListener('change', updateFilename);
            
            // Parse and format option text
            Array.from(versionSelect.options).forEach(option => {
                const originalText = option.textContent;
                option.textContent = formatSelectOption(originalText);
                option.setAttribute('data-original', originalText);
            });
        }
        
        // Enhance audio/subtitle selects with parsing
        const audioSelect = document.querySelector('select#selectAudioTrack');
        const subtitleSelect = document.querySelector('select#selectSubtitleTrack');
        
        [audioSelect, subtitleSelect].forEach(select => {
            if (select && !select._enhanced) {
                select._enhanced = true;
                Array.from(select.options).forEach(option => {
                    const originalText = option.textContent;
                    // For audio/subtitle, keep original parsing but clean up
                    option.setAttribute('data-original', originalText);
                });
            }
        });
    }

    function initToggle() {
        // Insert a small toggle control near the top of the page (inside the first form.trackSelections)
        const form = document.querySelector('form.trackSelections');
        if (!form) return;

        if (document.getElementById('stc-mode-toggle')) return; // already added

        const wrapper = document.createElement('div');
        wrapper.id = 'stc-mode-toggle';
        wrapper.style.cssText = 'display:flex;gap:8px;align-items:center;margin:6px 0;';

        const label = document.createElement('span');
        label.textContent = 'View:';
        label.style.color = 'rgba(255,255,255,0.85)';

        const select = document.createElement('select');
        select.style.cssText = 'background:rgba(0,0,0,0.35);color:#fff;padding:4px;border-radius:4px;border:1px solid rgba(255,255,255,0.08);';
        const optCards = document.createElement('option'); optCards.value = 'cards'; optCards.textContent = 'Cards';
        const optSelects = document.createElement('option'); optSelects.value = 'selects'; optSelects.textContent = 'Selects';
        select.appendChild(optCards); select.appendChild(optSelects);

        wrapper.appendChild(label);
        wrapper.appendChild(select);

        // Place wrapper before the form
        form.parentNode.insertBefore(wrapper, form);

        // Initialize from localStorage
        const mode = localStorage.getItem('baklava_view_mode') || 'cards';
        select.value = mode;
        applyMode(mode);

        select.addEventListener('change', () => {
            const v = select.value;
            localStorage.setItem('baklava_view_mode', v);
            applyMode(v);
        });
    }

    function applyMode(mode) {
        if (mode === 'selects') {
            document.body.classList.add('stc-show-selects');
            enhanceSelects();
        } else {
            document.body.classList.remove('stc-show-selects');
        }
    }

    // Run on DOMContentLoaded and on dynamic content changes (MutationObserver)
    function start() {
        initToggle();

        const observer = new MutationObserver((records) => {
            initToggle();
            if (document.body.classList.contains('stc-show-selects')) {
                enhanceSelects();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else start();
})();
