/*
 * select-to-select.js
 * Alternate UI: use <select> dropdowns instead of card carousels.
 */
(function () {
    'use strict';

    console.log('[SelectToSelect] Loading alternative select UI...');

    let currentItemId = null;

    function formatStreamTitle(stream, isAudio) {
        let langCode = stream.language || stream.displayLanguage || '';
        let lang = 'Unknown';
        
        if (langCode) {
            const langMap = {
                'eng': 'English', 'spa': 'Spanish', 'fre': 'French', 'fra': 'French',
                'ger': 'German', 'deu': 'German', 'ita': 'Italian', 'por': 'Portuguese',
                'rus': 'Russian', 'jpn': 'Japanese', 'kor': 'Korean', 'chi': 'Chinese',
                'zho': 'Chinese', 'ara': 'Arabic', 'hin': 'Hindi', 'tur': 'Turkish',
                'pol': 'Polish', 'dut': 'Dutch', 'nld': 'Dutch', 'swe': 'Swedish',
                'nor': 'Norwegian', 'dan': 'Danish', 'fin': 'Finnish', 'gre': 'Greek',
                'ell': 'Greek', 'heb': 'Hebrew', 'cze': 'Czech', 'ces': 'Czech',
                'hun': 'Hungarian', 'rum': 'Romanian', 'ron': 'Romanian', 'tha': 'Thai',
                'vie': 'Vietnamese', 'ind': 'Indonesian', 'may': 'Malay', 'msa': 'Malay',
                'ukr': 'Ukrainian', 'bul': 'Bulgarian', 'hrv': 'Croatian', 'srp': 'Serbian',
                'slv': 'Slovenian', 'cat': 'Catalan'
            };
            
            const lowerCode = langCode.toLowerCase();
            lang = langMap[lowerCode] || (langCode.charAt(0).toUpperCase() + langCode.slice(1).toLowerCase());
        }
        
        const codec = (stream.codec || '').toUpperCase();
        
        if (isAudio) {
            const channels = stream.channels || '';
            const parts = [lang];
            if (codec) parts.push(codec);
            if (channels) parts.push(`${channels}.0`);
            return parts.join(' | ');
        } else {
            const title = stream.title || '';
            const forced = stream.isForced ? ' [Forced]' : '';
            const parts = [lang];
            if (codec) parts.push(codec);
            if (title && !title.toLowerCase().includes(lang.toLowerCase())) parts.push(title);
            return parts.join(' | ') + forced;
        }
    }

    async function fetchStreams(itemId, mediaSourceId) {
        try {
            const params = new URLSearchParams({ itemId });
            if (mediaSourceId) params.append('mediaSourceId', mediaSourceId);
            params.append('_t', Date.now().toString());
            const url = window.ApiClient.getUrl('api/baklava/metadata/streams') + '?' + params;
            const response = await window.ApiClient.ajax({
                type: 'GET',
                url: url,
                dataType: 'json'
            });
            return response;
        } catch (err) {
            console.error('[SelectToSelect] Error fetching streams:', err);
            return null;
        }
    }

    async function populateTrackSelects(mediaSourceId) {
        if (!currentItemId) {
            console.warn('[SelectToSelect] No itemId available');
            return;
        }

        const audioSelect = document.querySelector('select.selectAudio');
        const subtitleSelect = document.querySelector('select.selectSubtitles');

        // Set to disabled with loading placeholder immediately
        if (audioSelect) {
            audioSelect.innerHTML = '';
            const loadingOption = document.createElement('option');
            loadingOption.value = '-1';
            loadingOption.textContent = 'Loading...';
            loadingOption.disabled = true;
            loadingOption.selected = true;
            audioSelect.appendChild(loadingOption);
            audioSelect.disabled = true;
        }

        if (subtitleSelect) {
            subtitleSelect.innerHTML = '';
            const loadingOption = document.createElement('option');
            loadingOption.value = '-1';
            loadingOption.textContent = 'Loading...';
            loadingOption.disabled = true;
            loadingOption.selected = true;
            subtitleSelect.appendChild(loadingOption);
            subtitleSelect.disabled = true;
        }

        console.log('[SelectToSelect] Fetching streams for itemId:', currentItemId, 'mediaSourceId:', mediaSourceId);
        const streams = await fetchStreams(currentItemId, mediaSourceId);
        
        if (!streams) {
            console.error('[SelectToSelect] Failed to fetch streams');
            if (audioSelect) {
                audioSelect.innerHTML = '';
                const emptyOption = document.createElement('option');
                emptyOption.value = '-1';
                emptyOption.textContent = 'No audio tracks';
                emptyOption.disabled = true;
                emptyOption.selected = true;
                audioSelect.appendChild(emptyOption);
                audioSelect.disabled = true;
            }
            if (subtitleSelect) {
                subtitleSelect.innerHTML = '';
                const offOption = document.createElement('option');
                offOption.value = '-1';
                offOption.textContent = 'Off';
                offOption.selected = true;
                subtitleSelect.appendChild(offOption);
                subtitleSelect.disabled = false;
            }
            return;
        }
        
        // Populate audio tracks
        if (audioSelect) {
            audioSelect.innerHTML = '';
            if (streams.audio && streams.audio.length > 0) {
                streams.audio.forEach((track, idx) => {
                    const option = document.createElement('option');
                    option.value = String(track.index);
                    option.textContent = formatStreamTitle(track, true);
                    if (idx === 0) option.selected = true;
                    audioSelect.appendChild(option);
                });
                audioSelect.disabled = false;
            } else {
                const emptyOption = document.createElement('option');
                emptyOption.value = '-1';
                emptyOption.textContent = 'No audio tracks';
                emptyOption.disabled = true;
                emptyOption.selected = true;
                audioSelect.appendChild(emptyOption);
                audioSelect.disabled = true;
            }
        }
        
        // Populate subtitle tracks
        if (subtitleSelect) {
            subtitleSelect.innerHTML = '';
            const offOption = document.createElement('option');
            offOption.value = '-1';
            offOption.textContent = 'Off';
            offOption.selected = true;
            subtitleSelect.appendChild(offOption);
            
            if (streams.subs && streams.subs.length > 0) {
                streams.subs.forEach((track) => {
                    const option = document.createElement('option');
                    option.value = String(track.index);
                    option.textContent = formatStreamTitle(track, false);
                    subtitleSelect.appendChild(option);
                });
                subtitleSelect.disabled = false;
            } else {
                subtitleSelect.disabled = false;
            }
        }
    }

    function captureItemId() {
        const urlParams = new URLSearchParams(window.location.search);
        const urlId = urlParams.get('id');
        if (urlId) {
            currentItemId = urlId;
            console.log('[SelectToSelect] Captured itemId from URL:', currentItemId);
            return;
        }
        
        const urlMatch = window.location.href.match(/[?&]id=([a-f0-9-]+)/i);
        if (urlMatch) {
            currentItemId = urlMatch[1].replace(/-/g, '');
            console.log('[SelectToSelect] Captured itemId from URL match:', currentItemId);
            return;
        }
        
        console.warn('[SelectToSelect] No itemId found');
    }

    async function enhanceSelects() {
        const versionSelect = document.querySelector('select.selectSource');
        if (!versionSelect) return;
        
        captureItemId();

        if (!versionSelect._stcEnhanced) {
            versionSelect._stcEnhanced = true;

            // Add filename display below version select
            const versionContainer = versionSelect.closest('.selectContainer');
            if (versionContainer && !versionContainer.querySelector('.stc-filename')) {
                const filenameDiv = document.createElement('div');
                filenameDiv.className = 'stc-filename';
                filenameDiv.style.cssText = 'margin: 8px 0; padding: 8px 12px; background: rgba(0,0,0,0.3); border-radius: 4px; color: rgba(255,255,255,0.6); font-size: 12px; text-align: center; font-family: monospace;';
                
                const updateFilename = () => {
                    const selectedOption = versionSelect.options[versionSelect.selectedIndex];
                    if (selectedOption) {
                        filenameDiv.textContent = selectedOption.textContent;
                    }
                };
                
                updateFilename();
                versionSelect.addEventListener('change', updateFilename);
                
                versionContainer.parentNode.insertBefore(filenameDiv, versionContainer.nextSibling);
            }

            // Fetch streams immediately on first load
            const initialMediaSourceId = versionSelect.value;
            if (initialMediaSourceId && currentItemId) {
                populateTrackSelects(initialMediaSourceId);
            }

            // Re-fetch when version changes
            versionSelect.addEventListener('change', () => {
                const mediaSourceId = versionSelect.value;
                if (mediaSourceId && currentItemId) {
                    populateTrackSelects(mediaSourceId);
                }
            });
        }
    }

    function start() {
        captureItemId();

        const observer = new MutationObserver(() => {
            if (document.body.classList.contains('stc-show-selects')) {
                enhanceSelects();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });

        if (document.body.classList.contains('stc-show-selects')) {
            enhanceSelects();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();