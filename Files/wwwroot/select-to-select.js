/*
 * select-to-select.js
 * Alternate UI: use <select> dropdowns instead of card carousels.
 */
(function () {
    'use strict';

    console.log('[SelectToSelect] Loading alternative select UI...');

    let currentItemId = null;

    // Parse version text same as cards
    function parseVersionText(text) {
        const qualityMatch = text.match(/(\d{3,4}p)/i);
        const quality = qualityMatch ? qualityMatch[1] : 'Unknown';
        const tokenRegex = /WEB-?DL|WEB|NF|DV|HEVC|HDR10\+?|HDR10|HDR|BLURAY|BLU-?RAY|BDRIP|BRRIP|X264|X265|H264|H265|UHD|REMUX/ig;
        const tokens = (text.match(tokenRegex) || []).map(t => t.toUpperCase());
        const versionLabel = tokens.join(' ') || 'Standard';
        return `${quality} - ${versionLabel}`;
    }

    // Format stream title (simplified from cards)
    function formatStreamTitle(stream, isAudio) {
        if (!stream) return 'Unknown';
        const lang = stream.Language || stream.DisplayLanguage || 'Unknown';
        const codec = stream.Codec?.toUpperCase() || '';
        const channels = stream.Channels ? `${stream.Channels}.0` : '';
        const parts = [lang];
        if (codec) parts.push(codec);
        if (channels) parts.push(channels);
        return parts.join(' | ');
    }

    // Fetch streams from API (same endpoint as cards)
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

    // Populate audio/subtitle selects from fetched streams
    async function populateTrackSelects(mediaSourceId) {
        if (!currentItemId) return;
        
        const streams = await fetchStreams(currentItemId, mediaSourceId);
        if (!streams) return;

        const audioSelect = document.querySelector('select#selectAudioTrack');
        const subtitleSelect = document.querySelector('select#selectSubtitleTrack');

        // Populate audio
        if (audioSelect && streams.audioStreams) {
            const currentValue = audioSelect.value;
            audioSelect.innerHTML = '';
            streams.audioStreams.forEach(stream => {
                const option = document.createElement('option');
                option.value = stream.Index;
                option.textContent = formatStreamTitle(stream, true);
                if (stream.Index == currentValue) option.selected = true;
                audioSelect.appendChild(option);
            });
        }

        // Populate subtitle
        if (subtitleSelect && streams.subtitleStreams) {
            const currentValue = subtitleSelect.value;
            subtitleSelect.innerHTML = '<option value="-1">None</option>';
            streams.subtitleStreams.forEach(stream => {
                const option = document.createElement('option');
                option.value = stream.Index;
                option.textContent = formatStreamTitle(stream, false);
                if (stream.Index == currentValue) option.selected = true;
                subtitleSelect.appendChild(option);
            });
        }
    }

    function enhanceSelects() {
        const versionSelect = document.querySelector('select#selectMediaSource');
        const audioSelect = document.querySelector('select#selectAudioTrack');
        const subtitleSelect = document.querySelector('select#selectSubtitleTrack');
        
        // Enhance version select
        if (versionSelect && !versionSelect._stcFilename) {
            // Create title/label for version select
            const versionLabel = document.createElement('div');
            versionLabel.className = 'stc-select-label';
            versionLabel.style.cssText = 'font-size: 1.1em; font-weight: 500; color: rgba(255,255,255,0.9); margin: 12px 0 8px 0;';
            versionLabel.textContent = 'Version';
            
            // Create filename display (use stc-filename class to match cards)
            const filenameDiv = document.createElement('div');
            filenameDiv.className = 'stc-filename';
            filenameDiv.style.cssText = 'margin: 8px 0; padding: 8px 12px; background: rgba(0,0,0,0.3); border-radius: 4px; color: rgba(255,255,255,0.6); font-size: 12px; text-align: center; font-family: monospace;';
            
            const container = versionSelect.closest('.selectContainer');
            if (container) {
                container.parentNode.insertBefore(versionLabel, container);
                container.parentNode.insertBefore(filenameDiv, container);
            }
            
            versionSelect._stcFilename = filenameDiv;
            versionSelect._stcLabel = versionLabel;
            
            // Update filename on change
            const updateFilename = () => {
                const selectedOption = versionSelect.options[versionSelect.selectedIndex];
                if (selectedOption) {
                    const originalText = selectedOption.getAttribute('data-original') || selectedOption.textContent;
                    filenameDiv.textContent = originalText;
                }
            };
            
            // Parse and format version options
            Array.from(versionSelect.options).forEach(option => {
                if (!option.hasAttribute('data-original')) {
                    option.setAttribute('data-original', option.textContent);
                    option.textContent = parseVersionText(option.textContent);
                }
            });
            
            updateFilename();
            
            // Populate tracks for initial selection
            const initialMediaSourceId = versionSelect.value;
            if (initialMediaSourceId) {
                populateTrackSelects(initialMediaSourceId);
            }
            
            // When version changes, fetch and populate audio/subtitle tracks
            versionSelect.addEventListener('change', () => {
                updateFilename();
                const mediaSourceId = versionSelect.value;
                populateTrackSelects(mediaSourceId);
            });
        }
        
        // Add labels for audio and subtitle selects
        if (audioSelect && !audioSelect._stcLabel) {
            const audioLabel = document.createElement('div');
            audioLabel.className = 'stc-select-label';
            audioLabel.style.cssText = 'font-size: 1.1em; font-weight: 500; color: rgba(255,255,255,0.9); margin: 12px 0 8px 0;';
            audioLabel.textContent = 'Audio Track';
            
            const audioContainer = audioSelect.closest('.selectContainer');
            if (audioContainer) {
                audioContainer.parentNode.insertBefore(audioLabel, audioContainer);
            }
            audioSelect._stcLabel = audioLabel;
        }
        
        if (subtitleSelect && !subtitleSelect._stcLabel) {
            const subtitleLabel = document.createElement('div');
            subtitleLabel.className = 'stc-select-label';
            subtitleLabel.style.cssText = 'font-size: 1.1em; font-weight: 500; color: rgba(255,255,255,0.9); margin: 12px 0 8px 0;';
            subtitleLabel.textContent = 'Subtitles';
            
            const subtitleContainer = subtitleSelect.closest('.selectContainer');
            if (subtitleContainer) {
                subtitleContainer.parentNode.insertBefore(subtitleLabel, subtitleContainer);
            }
            subtitleSelect._stcLabel = subtitleLabel;
        }
    }

    function start() {
        // Enhance selects when body has the class (set by plugin config)
        const observer = new MutationObserver(() => {
            if (document.body.classList.contains('stc-show-selects')) {
                enhanceSelects();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        
        // Check initial state
        if (document.body.classList.contains('stc-show-selects')) {
            enhanceSelects();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else start();
})();
