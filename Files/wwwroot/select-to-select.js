/**
 * Select to Select - Simplified & Reliable
 * Enhances playback version/audio/subtitle dropdowns with better styling and labels
 * Rewritten for simplicity, reliability, and faster initialization
 */
(function () {
    'use strict';
    
    // Prevent double-loading if script is injected multiple times
    if (window.SelectToSelectLoaded) {
        console.log('[SelectToSelect] Already loaded, skipping re-initialization');
        return;
    }
    window.SelectToSelectLoaded = true;
    
    console.log('[SelectToSelect] Loading simplified version...');

    // ============================================
    // STATE & CONFIGURATION
    // ============================================
    
    let initialized = false;
    let currentItemId = null;
    let streamCache = new Map(); // Cache streams per mediaSourceId to avoid re-fetching
    
    // Clear cache when navigating away or player stops
    function clearStreamCache() {
        console.log('[SelectToSelect] Clearing stream cache');
        streamCache.clear();
        // Don't clear currentItemId here - we might still need it
    }
    
    // ============================================
    // UTILITY FUNCTIONS
    // ============================================

    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func(...args), wait);
        };
    }

    function emitEvent(element, eventName) {
        const event = new Event(eventName, { bubbles: true, cancelable: true });
        element.dispatchEvent(event);
    }

    async function fetchStreams(itemId, mediaSourceId, forceRefresh = false) {
        const cacheKey = `${itemId}_${mediaSourceId}`;
        
        // Return cached result if available and fresh (under 3 seconds old) and not forced
        if (!forceRefresh && streamCache.has(cacheKey)) {
            const cached = streamCache.get(cacheKey);
            if (Date.now() - cached.timestamp < 3000) {
                console.log('[SelectToSelect] Using cached streams for', cacheKey);
                return cached.data;
            }
        }
        
        console.log('[SelectToSelect] Fetching streams for itemId:', itemId, 'mediaSourceId:', mediaSourceId);
        
        try {
            const params = new URLSearchParams({ itemId });
            if (mediaSourceId) params.append('mediaSourceId', mediaSourceId);
            // Add timestamp to force bypass any HTTP cache
            params.append('_t', Date.now().toString());

            const url = window.ApiClient.getUrl('api/baklava/metadata/streams') + '?' + params;
            const response = await window.ApiClient.ajax({
                type: 'GET',
                url: url,
                dataType: 'json'
            });

            // Cache the result
            streamCache.set(cacheKey, {
                data: response,
                timestamp: Date.now()
            });

            return response;
        } catch (err) {
            console.error('[SelectToSelect] Error fetching streams:', err);
            return null;
        }
    }

    function formatStreamTitle(stream, isAudio) {
        // Get language - convert to full name and capitalize first letter
        let langCode = stream.language || stream.displayLanguage || '';
        let lang = 'Unknown';
        
        if (langCode) {
            // Map common language codes to full names
            const langMap = {
                'eng': 'English',
                'spa': 'Spanish',
                'fre': 'French',
                'fra': 'French',
                'ger': 'German',
                'deu': 'German',
                'ita': 'Italian',
                'por': 'Portuguese',
                'rus': 'Russian',
                'jpn': 'Japanese',
                'kor': 'Korean',
                'chi': 'Chinese',
                'zho': 'Chinese',
                'ara': 'Arabic',
                'hin': 'Hindi',
                'tur': 'Turkish',
                'pol': 'Polish',
                'dut': 'Dutch',
                'nld': 'Dutch',
                'swe': 'Swedish',
                'nor': 'Norwegian',
                'dan': 'Danish',
                'fin': 'Finnish',
                'gre': 'Greek',
                'ell': 'Greek',
                'heb': 'Hebrew',
                'cze': 'Czech',
                'ces': 'Czech',
                'hun': 'Hungarian',
                'rum': 'Romanian',
                'ron': 'Romanian',
                'tha': 'Thai',
                'vie': 'Vietnamese',
                'ind': 'Indonesian',
                'may': 'Malay',
                'msa': 'Malay',
                'ukr': 'Ukrainian',
                'bul': 'Bulgarian',
                'hrv': 'Croatian',
                'srp': 'Serbian',
                'slv': 'Slovenian',
                'cat': 'Catalan'
            };
            
            const lowerCode = langCode.toLowerCase();
            if (langMap[lowerCode]) {
                lang = langMap[lowerCode];
            } else {
                // Capitalize first letter of unknown language
                lang = langCode.charAt(0).toUpperCase() + langCode.slice(1).toLowerCase();
            }
        }
        
        const codec = (stream.codec || '').toUpperCase();
        const type = isAudio 
            ? (stream.channels === 2 ? 'Stereo' : stream.channels ? `${stream.channels}ch` : codec)
            : codec;
        
        return { lang, type };
    }

    function parseVersionText(text, option) {
        // Mirror parsing logic from select-to-cards: extract quality and version tokens
        const t = (text || '').trim();
        const qualityMatch = t.match(/(\d{3,4}p)/i);
        const quality = qualityMatch ? qualityMatch[1] : '';

        const tokenRegex = /WEB-?DL|WEB|NF|DV|HEVC|HDR10\+?|HDR10|HDR|BLURAY|BLU-?RAY|BDRIP|BRRIP|X264|X265|H264|H265|UHD|REMUX/ig;
        const tokens = (t.match(tokenRegex) || []).map(s => s.toUpperCase());
        const versionLabel = tokens.join(' ') || (option && option.getAttribute('data-version')) || '';

        return { versionLabel: versionLabel || 'Standard', quality: quality || 'Unknown' };
    }

    // ============================================
    // UI STYLING
    // ============================================

    function injectStyles() {
        if (document.getElementById('select-to-select-style')) return;
        
        const style = document.createElement('style');
        style.id = 'select-to-select-style';
        style.textContent = `
            /* Hide original select containers but keep the selects visible */
            form.trackSelections .selectContainer { 
                margin: 0 !important;
                padding: 0 !important;
            }
            
            /* Wrapper for enhanced selects */
            .sts-wrapper {
                margin-bottom: 20px;
            }

            /* Force trackSelections to take full width so our wrappers align correctly */
            .detailSection .trackSelections,
            form.trackSelections,
            .trackSelections {
                width: 100% !important;
                max-width: unset !important;
            }
            
            /* Labels for selects */
            .sts-label {
                font-size: 1.1em;
                font-weight: 500;
                color: rgba(255,255,255,0.9);
                margin-bottom: 8px;
                display: block;
                text-align: center;
            }
            
            /* Filename display for version select */
            .sts-filename {
                margin: 8px 0;
                padding: 8px 12px;
                background: rgba(0,0,0,0.3);
                border-radius: 4px;
                color: rgba(255,255,255,0.6);
                font-size: 12px;
                text-align: center;
                font-family: monospace;
                word-break: break-all;
            }
            
            /* Style all selects in the form */
            form.trackSelections select {
                width: 100%;
                padding: 10px 12px;
                border: 1px solid rgba(255,255,255,0.15);
                border-radius: 6px;
                color: rgba(255,255,255,0.9);
                font-size: 14px;
                cursor: pointer;
                transition: all 0.2s ease;
            }

            /* Enhanced select styling: centered text and custom arrow */
            .sts-enhanced-select {
                padding-right: 40px; /* room for custom arrow */
                text-align: center; /* center the visible text */
                -moz-text-align-last: center;
                text-align-last: center;
                background: rgba(255,255,255,0.08) url("data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2024%2024'%20width='14'%20height='14'%20fill='none'%20stroke='%23ffffff'%20stroke-width='2'%20stroke-linecap='round'%20stroke-linejoin='round'%3E%3Cpolyline%20points='6%209%2012%2015%2018%209'/%3E%3C/svg%3E") no-repeat right 12px center;
                background-size: 14px 14px;
            }
            
            form.trackSelections select:hover {
                background: rgba(255,255,255,0.12);
                border-color: rgba(255,255,255,0.3);
            }
            
            form.trackSelections select:focus {
                outline: none;
                border-color: #00a4dc;
                background: rgba(255,255,255,0.1);
            }
            
            form.trackSelections select:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            
            form.trackSelections select option {
                background: #1a1a1a;
                color: rgba(255,255,255,0.9);
                padding: 8px;
                text-align: center; /* try to center option text where supported */
            }
            
            /* Separator line */
            .sts-separator {
                margin: 20px 0;
                height: 1px;
                background: rgba(255,255,255,0.1);
                border: none;
            }
            
            /* Toggle to show original behavior */
            body.sts-show-selects form.trackSelections .selectContainer { 
                display: block !important; 
            }
        `;
        
        document.head.appendChild(style);
    }

    // ============================================
    // SELECTION HANDLING (simplified for native selects)
    // ============================================

    function selectCard(select, value, type) {
        console.log('[SelectToSelect] Selecting', type, 'value:', value);
        
        // Update select element
        Array.from(select.options).forEach(opt => {
            opt.selected = opt.value === value;
        });
        
        // Emit change events
        emitEvent(select, 'change');
        emitEvent(select, 'input');
        
        // If version changed, load new audio/subtitle tracks
        if (type === 'version') {
            loadTracksForVersion(select, value);
        }
    }

    async function loadTracksForVersion(versionSelect, mediaSourceId) {
        console.log('[SelectToSelect] Loading tracks for version:', mediaSourceId);
        
        const form = versionSelect.closest('form.trackSelections');
        if (!form) return;
        
        let audioSelect = form.querySelector('select.selectAudio');
        let subtitleSelect = form.querySelector('select.selectSubtitles');

        // If selects are missing for some reason (dynamic UI), create placeholders now
        if (!audioSelect) {
            console.log('[SelectToSelect] Audio select missing, creating placeholder');
            audioSelect = document.createElement('select');
            audioSelect.className = 'detailTrackSelect selectAudio';
            audioSelect.disabled = true;
            const opt = document.createElement('option');
            opt.textContent = 'No audio tracks';
            opt.disabled = true;
            audioSelect.appendChild(opt);
            // Insert into form
            const container = form.querySelector('.selectContainer.selectAudioContainer') || form;
            container.appendChild(audioSelect);
            // Create wrapper/label
            populateSelectDropdown(audioSelect, 'audio');
            audioSelect._stsPopulated = true;
        }

        if (!subtitleSelect) {
            console.log('[SelectToSelect] Subtitle select missing, creating placeholder');
            subtitleSelect = document.createElement('select');
            subtitleSelect.className = 'detailTrackSelect selectSubtitles';
            subtitleSelect.disabled = true;
            const opt = document.createElement('option');
            opt.textContent = 'No subtitles';
            opt.disabled = true;
            subtitleSelect.appendChild(opt);
            const container = form.querySelector('.selectContainer.selectSubtitlesContainer') || form;
            container.appendChild(subtitleSelect);
            populateSelectDropdown(subtitleSelect, 'subtitle');
            subtitleSelect._stsPopulated = true;
        }
        
        // Show loading state
        if (audioSelect) {
            audioSelect.innerHTML = '';
            const loadingOption = document.createElement('option');
            loadingOption.textContent = 'Loading...';
            loadingOption.disabled = true;
            audioSelect.appendChild(loadingOption);
            audioSelect.disabled = true;
        }
        
        if (subtitleSelect) {
            subtitleSelect.innerHTML = '';
            const loadingOption = document.createElement('option');
            loadingOption.textContent = 'Loading...';
            loadingOption.disabled = true;
            subtitleSelect.appendChild(loadingOption);
            subtitleSelect.disabled = true;
        }
        
        // Try to get itemId if we don't have it
        if (!currentItemId) {
            console.log('[SelectToSelect] No currentItemId, attempting to capture...');
            captureItemId();
        }
        
        // Fetch streams
        if (!currentItemId) {
            console.warn('[SelectToSelect] No itemId available after capture attempt');
            if (audioSelect) {
                audioSelect.innerHTML = '';
                const option = document.createElement('option');
                option.textContent = 'No audio tracks';
                option.disabled = true;
                audioSelect.appendChild(option);
            }
            if (subtitleSelect) {
                subtitleSelect.innerHTML = '';
                const option = document.createElement('option');
                option.value = '-1';
                option.textContent = 'Off';
                subtitleSelect.appendChild(option);
                subtitleSelect.disabled = false;
            }
            return;
        }
        
    console.log('[SelectToSelect] Fetching streams with itemId:', currentItemId, 'mediaSourceId:', mediaSourceId);
    const streams = await fetchStreams(currentItemId, mediaSourceId);
    console.log('[SelectToSelect] Streams response:', streams);
        
        if (!streams) {
            console.error('[SelectToSelect] Failed to fetch streams');
            if (audioSelect) {
                audioSelect.innerHTML = '';
                const option = document.createElement('option');
                option.textContent = 'No audio tracks';
                option.disabled = true;
                audioSelect.appendChild(option);
            }
            if (subtitleSelect) {
                subtitleSelect.innerHTML = '';
                const option = document.createElement('option');
                option.value = '-1';
                option.textContent = 'Off';
                subtitleSelect.appendChild(option);
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
                    const fmt = formatStreamTitle(track, true);
                    option.textContent = track.title || (fmt.lang + (fmt.type ? ' • ' + fmt.type : ''));
                    option._meta = track;
                    if (idx === 0) option.selected = true;
                    audioSelect.appendChild(option);
                });
                audioSelect.disabled = false;
            } else {
                const option = document.createElement('option');
                option.textContent = 'No audio tracks';
                option.disabled = true;
                audioSelect.appendChild(option);
            }
            // Wrapper/label already created in initializeForm, no need to recreate
            console.log('[SelectToSelect] Audio select populated, options:', audioSelect.options.length);
            // Emit change/input so the host UI picks up the selection
            emitEvent(audioSelect, 'change');
            emitEvent(audioSelect, 'input');
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
                    const fmt = formatStreamTitle(track, false);
                    option.textContent = track.title || fmt.lang || ('Subtitle ' + track.index);
                    option._meta = track;
                    subtitleSelect.appendChild(option);
                });
            }
            subtitleSelect.disabled = false;
            // Wrapper/label already created in initializeForm, no need to recreate
            console.log('[SelectToSelect] Subtitle select populated, options:', subtitleSelect.options.length);
            emitEvent(subtitleSelect, 'change');
            emitEvent(subtitleSelect, 'input');
        }
    }

    // ============================================
    // SELECT DROPDOWN CREATION
    // ============================================

    function populateSelectDropdown(select, type) {
        if (!select) return;
        
        // Get or create wrapper
        let wrapper = select._stsWrapper;
        let labelDiv = select._stsLabel;
        let filenameDiv = select._stsFilename;
        
        if (!wrapper) {
            wrapper = document.createElement('div');
            wrapper.className = 'sts-wrapper';
            wrapper.style.cssText = 'margin-bottom: 20px;';
            
            if (type === 'version') {
                // For version: add filename div only (we avoid duplicating the host's label)
                filenameDiv = document.createElement('div');
                filenameDiv.className = 'sts-filename';
                filenameDiv.style.cssText = 'margin: 8px 0; padding: 8px 12px; background: rgba(0,0,0,0.3); border-radius: 4px; color: rgba(255,255,255,0.6); font-size: 12px; text-align: center; font-family: monospace;';
                wrapper.appendChild(filenameDiv);
            } else {
                // For audio/subtitle: add label only
                labelDiv = document.createElement('div');
                labelDiv.className = 'sts-label';
                labelDiv.style.cssText = 'font-size: 1.1em; font-weight: 500; color: rgba(255,255,255,0.9); margin-bottom: 8px;';
                labelDiv.textContent = type === 'audio' ? 'Audio Track' : 'Subtitles';
                wrapper.appendChild(labelDiv);
            }
            
            // Insert wrapper into the DOM and MOVE the actual <select> into the wrapper.
            // This guarantees the visible UI lives inside our wrapper even if the original
            // .selectContainer is hidden by the host CSS.
            const selectContainer = select.closest('.selectContainer');
            if (selectContainer && selectContainer.parentNode) {
                // Insert wrapper before the original container, then move the select into the wrapper
                selectContainer.parentNode.insertBefore(wrapper, selectContainer);
            } else if (select.parentNode) {
                // If there's no container, insert wrapper before the select
                select.parentNode.insertBefore(wrapper, select);
            } else {
                // Fallback: append to the form
                const form = select.closest('form.trackSelections') || document.body;
                form.appendChild(wrapper);
            }

            // Move the select element into our wrapper so it's visible regardless of host styling
            try {
                wrapper.appendChild(select);
            } catch (e) {
                console.warn('[SelectToSelect] Failed to move select into wrapper:', e);
            }

            // Remove the original selectContainer left behind by the host if it's now empty or contains just label/arrow
            try {
                if (selectContainer && selectContainer.parentNode) {
                    // Only remove if it doesn't contain other interactive elements
                    const hasOtherSelects = selectContainer.querySelectorAll('select').length > 0;
                    if (!hasOtherSelects) {
                        selectContainer.parentNode.removeChild(selectContainer);
                    }
                }
            } catch (e) {
                console.warn('[SelectToSelect] Failed to remove original selectContainer:', e);
            }
            
            select._stsWrapper = wrapper;
            select._stsLabel = labelDiv;
            select._stsFilename = filenameDiv;
        }
        
    // Style the select itself: add a helper class so injected CSS (arrow, centering) applies
    select.classList.add('sts-enhanced-select');
    // Ensure width remains full-width if other styles override
    select.style.width = '100%';
        
        // Update filename display if version select
        if (type === 'version' && filenameDiv && select.options.length > 0) {
            const updateFilename = () => {
                const selectedOption = select.options[select.selectedIndex];
                if (selectedOption) {
                    // Store original filename if not already stored
                    if (!selectedOption.hasAttribute('data-original')) {
                        selectedOption.setAttribute('data-original', selectedOption.textContent);
                    }
                    // Show the full original filename in the sts-filename div (do not show parsed short label)
                    const original = selectedOption.getAttribute('data-original') || selectedOption.textContent;
                    filenameDiv.textContent = original;
                }
            };
            
            updateFilename();
            
            // Update filename on change
            if (!select._stsFilenameListener) {
                select._stsFilenameListener = updateFilename;
                select.addEventListener('change', updateFilename);
            }
        }
        
        // Add separator line after each select
        // Skip adding a trailing separator after the subtitles block
        if (type !== 'subtitle') {
            const existingSeparator = wrapper.nextElementSibling?.nextElementSibling;
            if (!existingSeparator || !existingSeparator.classList.contains('sts-separator')) {
            const separator = document.createElement('hr');
            separator.className = 'sts-separator';
            separator.style.cssText = 'margin: 20px 0; height: 1px; background: rgba(255,255,255,0.1); border: none;';
            const selectContainer = select.closest('.selectContainer');
            if (selectContainer && selectContainer.nextSibling) {
                selectContainer.parentNode.insertBefore(separator, selectContainer.nextSibling);
            } else if (select.nextSibling) {
                select.parentNode.insertBefore(separator, select.nextSibling);
            } else if (select.parentNode) {
                select.parentNode.appendChild(separator);
            }
            }
        }
    }

    // ============================================
    // INITIALIZATION
    // ============================================

    function captureItemId() {
        // Try multiple sources to get the current item ID
        
        // 1. From URL
        const urlMatch = window.location.href.match(/[?&]id=([a-f0-9-]+)/i);
        if (urlMatch) {
            currentItemId = urlMatch[1].replace(/-/g, '');
            console.log('[SelectToSelect] Captured itemId from URL:', currentItemId);
            return;
        }
        
        // 2. From form
        const form = document.querySelector('form.trackSelections');
        if (form) {
            const itemIdInput = form.querySelector('input[name*="itemId"], input[name*="Id"]');
            if (itemIdInput?.value) {
                currentItemId = itemIdInput.value.replace(/-/g, '');
                console.log('[SelectToSelect] Captured itemId from form input:', currentItemId);
                return;
            }
        }
        
        // 3. From global window variables
        if (window.__currentPlaybackItemId) {
            currentItemId = window.__currentPlaybackItemId;
            console.log('[SelectToSelect] Using window.__currentPlaybackItemId:', currentItemId);
            return;
        }
        
        console.warn('[SelectToSelect] Could not capture itemId');
    }

    function initializeForm() {
        const form = document.querySelector('form.trackSelections');
        if (!form || form._stcInitialized) return;
        
        console.log('[SelectToSelect] Initializing form');
        form._stcInitialized = true;
        
        captureItemId();
        
        // Always ensure audio/subtitle selects exist as placeholders if missing
        const selectTypes = [
            { className: 'selectSource', type: 'version' },
            { className: 'selectAudio', type: 'audio' },
            { className: 'selectSubtitles', type: 'subtitle' }
        ];

        selectTypes.forEach(({ className, type }) => {
            let select = form.querySelector('select.' + className);
            if (!select) {
                // Create placeholder select if missing
                select = document.createElement('select');
                select.className = 'detailTrackSelect ' + className;
                select.disabled = true;
                const option = document.createElement('option');
                option.textContent = (type === 'version') ? 'No versions' : (type === 'audio' ? 'No audio tracks' : 'No subtitles');
                option.disabled = true;
                select.appendChild(option);
                // Find where to insert: after previous selectContainer or at end
                let container = form.querySelector('.selectContainer.' + className + 'Container');
                if (!container) {
                    // Fallback: create a container div
                    container = document.createElement('div');
                    container.className = 'selectContainer ' + className + 'Container';
                    form.appendChild(container);
                }
                container.appendChild(select);
            }
        });

        // Now get all selects (skip selectVideo)
        const selects = Array.from(form.querySelectorAll('select.detailTrackSelect'))
            .filter(sel => !sel.classList.contains('selectVideo'));

        // Hide video select container
        const videoContainer = form.querySelector('.selectVideoContainer');
        if (videoContainer) {
            videoContainer.style.display = 'none';
        }

        selects.forEach(select => {
            let type = 'unknown';
            if (select.classList.contains('selectSource')) type = 'version';
            else if (select.classList.contains('selectAudio')) type = 'audio';
            else if (select.classList.contains('selectSubtitles')) type = 'subtitle';

            // Always create wrapper/label for audio/subtitle (even if empty)
            if (type === 'audio' || type === 'subtitle') {
                populateSelectDropdown(select, type);
                select._stsPopulated = true;
            }

            // For version select, populate immediately if options exist
            if (type === 'version') {
                if (select.options.length > 0) {
                    populateSelectDropdown(select, type);
                    // Parse and rewrite option visible text to concise version label + quality
                    Array.from(select.options).forEach(opt => {
                        try {
                            if (!opt.hasAttribute('data-original')) opt.setAttribute('data-original', opt.textContent || '');
                            const parsed = parseVersionText(opt.getAttribute('data-original') || opt.textContent, opt);
                            // Don't overwrite placeholders or disabled empty options
                            if (!opt.disabled || (opt.value && opt.value !== '')) {
                                opt.textContent = parsed.versionLabel + (parsed.quality ? ' • ' + parsed.quality : '');
                            }
                        } catch (e) {
                            console.warn('[SelectToSelect] Failed to parse version option', e);
                        }
                    });
                    const selectedOption = Array.from(select.options).find(opt => opt.selected);
                    if (selectedOption) {
                        setTimeout(() => {
                            loadTracksForVersion(select, selectedOption.value);
                        }, 100);
                    }
                    if (!select._stsChangeListener) {
                        select._stsChangeListener = true;
                        select.addEventListener('change', () => {
                            const newValue = select.value;
                            loadTracksForVersion(select, newValue);
                        });
                    }
                } else {
                    // Watch for options being added dynamically to version select
                    const versionObserver = new MutationObserver(() => {
                        if (select.options.length > 0 && !select._stsPopulated) {
                            select._stsPopulated = true;
                            populateSelectDropdown(select, type);
                            // Parse and rewrite option visible text when options are dynamically added
                            Array.from(select.options).forEach(opt => {
                                try {
                                    if (!opt.hasAttribute('data-original')) opt.setAttribute('data-original', opt.textContent || '');
                                    const parsed = parseVersionText(opt.getAttribute('data-original') || opt.textContent, opt);
                                    if (!opt.disabled || (opt.value && opt.value !== '')) {
                                        opt.textContent = parsed.versionLabel + (parsed.quality ? ' • ' + parsed.quality : '');
                                    }
                                } catch (e) {
                                    console.warn('[SelectToSelect] Failed to parse dynamic version option', e);
                                }
                            });
                            const selectedOption = Array.from(select.options).find(opt => opt.selected);
                            if (selectedOption) {
                                setTimeout(() => {
                                    loadTracksForVersion(select, selectedOption.value);
                                }, 100);
                            }
                            if (!select._stsChangeListener) {
                                select._stsChangeListener = true;
                                select.addEventListener('change', () => {
                                    const newValue = select.value;
                                    loadTracksForVersion(select, newValue);
                                });
                            }
                        }
                    });
                    versionObserver.observe(select, { childList: true });
                }
            }
        });
    }

    // ============================================
    // OBSERVERS & HOOKS
    // ============================================

    function movePortraitCard() {
        // Move .card.portraitCard to #itemDetailPage
        const portraitCard = document.querySelector('.card.portraitCard');
        const itemDetailPage = document.getElementById('itemDetailPage');
        
        if (portraitCard && itemDetailPage && !portraitCard._moved) {
            console.log('[SelectToSelect] Moving portrait card to itemDetailPage');
            portraitCard._moved = true;
            itemDetailPage.insertBefore(portraitCard, itemDetailPage.firstChild);
        }
    }

    function setupObservers() {
        // Watch for form additions and portrait card
        const observer = new MutationObserver(mutations => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType !== 1) continue;
                    
                    if (node.matches?.('form.trackSelections') || node.querySelector?.('form.trackSelections')) {
                        setTimeout(initializeForm, 50);
                    }
                    
                    // Check for portrait card or itemDetailPage
                    if (node.matches?.('.card.portraitCard') || node.querySelector?.('.card.portraitCard') ||
                        node.matches?.('#itemDetailPage') || node.querySelector?.('#itemDetailPage')) {
                        setTimeout(movePortraitCard, 50);
                    }
                }
            }
        });
        
        observer.observe(document.body, { childList: true, subtree: true });
        
        // Also check on modal open events
        document.addEventListener('openDetailsModal', () => {
            setTimeout(initializeForm, 100);
        });
        
        // Clear cache when navigating away (detect page changes)
        let lastUrl = window.location.href;
        const urlCheckInterval = setInterval(() => {
            const currentUrl = window.location.href;
            if (currentUrl !== lastUrl) {
                // Only log if we actually had a cache to clear
                if (streamCache.size > 0) {
                    console.log('[SelectToSelect] URL changed, clearing cache');
                }
                clearStreamCache();
                lastUrl = currentUrl;
            }
        }, 2000); // Check every 2 seconds instead of 1
        
        // Listen for player stop/exit events
        document.addEventListener('playbackstop', () => {
            console.log('[SelectToSelect] Playback stopped, clearing cache');
            clearStreamCache();
        });
        
        document.addEventListener('playbackerror', () => {
            console.log('[SelectToSelect] Playback error, clearing cache');
            clearStreamCache();
        });
        
        // Watch for modal/dialog closures (when user exits playback UI)
        const modalObserver = new MutationObserver(mutations => {
            for (const mutation of mutations) {
                for (const node of mutation.removedNodes) {
                    if (node.nodeType !== 1) continue;
                    
                    // If the details modal or player UI is removed, clear cache
                    if (node.id === 'item-detail-modal-overlay' || 
                        node.classList?.contains('videoPlayerContainer') ||
                        node.querySelector?.('form.trackSelections')) {
                        console.log('[SelectToSelect] Player UI removed, clearing cache');
                        clearStreamCache();
                    }
                }
            }
        });
        
        modalObserver.observe(document.body, { childList: true, subtree: true });
        
        // Watch for API calls to capture itemId
        if (window.ApiClient?.ajax) {
            const originalAjax = window.ApiClient.ajax;
            window.ApiClient.ajax = function(options) {
                // Try to extract itemId from API calls
                if (options?.url) {
                    const match = options.url.match(/\/Items\/([a-f0-9-]+)/i);
                    if (match) {
                        const extractedId = match[1].replace(/-/g, '');
                        if (extractedId.length === 32) {
                            // If itemId changed, clear cache
                            if (currentItemId && currentItemId !== extractedId) {
                                console.log('[SelectToSelect] Item changed, clearing cache');
                                clearStreamCache();
                            }
                            currentItemId = extractedId;
                            console.log('[SelectToSelect] Intercepted itemId from API:', currentItemId);
                        }
                    }
                }
                
                return originalAjax.apply(this, arguments);
            };
        }
    }

    // ============================================
    // STARTUP
    // ============================================

    function init() {
        if (initialized) return;
        initialized = true;
        
        console.log('[SelectToSelect] Initializing...');
        
        injectStyles();
        setupObservers();
        movePortraitCard(); // Try to move portrait card immediately if it exists
        
        // Check if form already exists
        if (document.querySelector('form.trackSelections')) {
            initializeForm();
        }
    }

    // Start on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    console.log('[SelectToSelect] Simplified version loaded');
})();
