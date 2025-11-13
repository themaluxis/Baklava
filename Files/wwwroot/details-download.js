/**
 * Details Page Download Button
 * Adds a download button to the mainDetailButtons container
 * Initiates downloads and tracks progress in the downloads window
 */
(function() {
    'use strict';

    // ============================================
    // CONFIGURATION CHECK
    // ============================================
    
    async function checkDownloadsEnabled() {
        try {
            const config = await window.ApiClient.ajax({
                type: 'GET',
                url: window.ApiClient.getUrl('api/baklava/config'),
                dataType: 'json'
            });
            return config?.enableDownloads === true;
        } catch (err) {
            console.error('[Downloads] Failed to check config:', err);
            return false;
        }
    }

    // ============================================
    // DOWNLOAD STATE MANAGEMENT
    // ============================================
    
    let activeDownloads = [];
    let completedDownloads = [];
    let failedDownloads = [];

    // ============================================
    // DOWNLOAD BUTTON INJECTION
    // ============================================

    function createDownloadButton() {
        const btn = document.createElement('button');
        btn.setAttribute('is', 'emby-button');
        btn.setAttribute('type', 'button');
        btn.className = 'button-flat btnDownloadMedia hide detailButton emby-button';
        btn.title = 'Download';
        
        btn.innerHTML = `
            <div class="detailButton-content">
                <span class="material-icons detailButton-icon get_app" aria-hidden="true"></span>
            </div>
        `;
        
        return btn;
    }

    function injectDownloadButton() {
        // Find the mainDetailButtons container
        const detailButtons = document.querySelector('.mainDetailButtons');
        if (!detailButtons) {
            return;
        }

        // Check if button already exists
        if (detailButtons.querySelector('.btnDownloadMedia')) {
            return;
        }

        // Create and insert the download button after the Play button
        const downloadBtn = createDownloadButton();
        const playButton = detailButtons.querySelector('.btnPlay');
        
        if (playButton) {
            playButton.parentNode.insertBefore(downloadBtn, playButton.nextSibling);
        } else {
            // Fallback: insert at the beginning
            detailButtons.insertBefore(downloadBtn, detailButtons.firstChild);
        }

        // Show the button
        downloadBtn.classList.remove('hide');

        // Attach click handler
        downloadBtn.addEventListener('click', handleDownloadClick);
    }

    // ============================================
    // DOWNLOAD LOGIC
    // ============================================

    async function getCurrentItem() {
        const itemId = getParameterByName('id');
        if (!itemId || !window.ApiClient) return null;

        try {
            return await window.ApiClient.getItem(window.ApiClient.getCurrentUserId(), itemId);
        } catch {
            return null;
        }
    }

    function getParameterByName(name) {
        const url = window.location.href;
        name = name.replace(/[\[\]]/g, '\\$&');
        const regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)');
        const results = regex.exec(url);
        if (!results) return null;
        if (!results[2]) return '';
        return decodeURIComponent(results[2].replace(/\+/g, ' '));
    }

    async function handleDownloadClick(e) {
        e.preventDefault();
        e.stopPropagation();

        const button = e.currentTarget;
        
        // Disable button during processing
        button.disabled = true;
        const icon = button.querySelector('.material-icons');
        const originalIcon = icon.textContent;
        icon.textContent = 'hourglass_empty';

        try {
            const item = await getCurrentItem();
            if (!item) throw new Error('Could not fetch item details');

            // Get current user ID
            const userId = window.ApiClient.getCurrentUserId();
            if (!userId) throw new Error('Could not get user ID');

            // Call backend API to start download
            const response = await window.ApiClient.ajax({
                type: 'POST',
                url: window.ApiClient.getUrl('api/baklava/downloads'),
                data: JSON.stringify({ 
                    jellyfinId: item.Id,
                    userId: userId 
                }),
                contentType: 'application/json',
                dataType: 'json'
            });

            if (!response || !response.id) throw new Error('Failed to start download');

            // Create download object for UI
            const download = {
                id: response.id,
                jellyfinId: item.Id,
                title: item.Name,
                year: item.ProductionYear || '',
                itemType: item.Type?.toLowerCase() || 'movie',
                img: getItemImageUrl(item),
                status: 'active',
                progress: 0,
                startedAt: new Date().toISOString(),
                size: response.download?.size || 0
            };

            // Add to active downloads
            activeDownloads.push(download);

            // Notify downloads window
            if (window.DownloadsWindow) {
                window.DownloadsWindow.reload();
            }

            // Dispatch event for other components
            document.dispatchEvent(new CustomEvent('downloadStarted', { detail: download }));

            // Show success feedback
            icon.textContent = 'check';
            setTimeout(() => {
                icon.textContent = originalIcon;
                button.disabled = false;
            }, 2000);

        } catch (err) {
            // Show error feedback
            icon.textContent = 'error';
            setTimeout(() => {
                icon.textContent = originalIcon;
                button.disabled = false;
            }, 2000);
        }
    }

    function getItemImageUrl(item) {
        if (!item.ImageTags?.Primary && !item.SeriesId) {
            return '';
        }

        const itemId = item.ImageTags?.Primary ? item.Id : item.SeriesId;
        return window.ApiClient.getScaledImageUrl(itemId, {
            type: 'Primary',
            maxWidth: 300,
            quality: 90
        });
    }

    // ============================================
    // DOWNLOAD STATE ACCESS (for compatibility)
    // ============================================

    function getActiveDownloads() {
        return [...activeDownloads];
    }

    function getCompletedDownloads() {
        return [...completedDownloads];
    }

    function getFailedDownloads() {
        return [...failedDownloads];
    }

    function getDownloadById(id) {
        // Search in all download arrays
        let download = activeDownloads.find(d => d.id === id);
        if (download) return download;
        
        download = completedDownloads.find(d => d.id === id);
        if (download) return download;
        
        download = failedDownloads.find(d => d.id === id);
        if (download) return download;
        
        return null;
    }

    // ============================================
    // PAGE MONITORING
    // ============================================

    function observePageChanges() {
        // Watch for detail page loads
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.addedNodes.length) {
                    const detailButtons = document.querySelector('.mainDetailButtons');
                    if (detailButtons && !detailButtons.querySelector('.btnDownloadMedia')) {
                        setTimeout(injectDownloadButton, 100);
                    }
                }
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Initial injection
        setTimeout(injectDownloadButton, 500);
        setTimeout(injectDownloadButton, 1500);
        setTimeout(injectDownloadButton, 3000);
    }

    // ============================================
    // INITIALIZATION
    // ============================================

    async function init() {
        // Wait for ApiClient to be ready
        const waitForApiClient = () => {
            return new Promise(resolve => {
                if (window.ApiClient) {
                    resolve();
                } else {
                    setTimeout(() => waitForApiClient().then(resolve), 100);
                }
            });
        };
        
        await waitForApiClient();
        
        // Check if downloads are enabled in config
        const enabled = await checkDownloadsEnabled();
        if (!enabled) {
            console.log('[Download Button] Disabled in config, skipping initialization');
            return;
        }
        
        console.log('[Download Button] Enabled, initializing...');
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', observePageChanges);
        } else {
            observePageChanges();
        }

        document.addEventListener('viewshow', () => {
            setTimeout(injectDownloadButton, 100);
        });
    }

    // Start initialization
    init();

    // ============================================
    // GLOBAL API
    // ============================================

    window.DownloadManager = {
        getActiveDownloads,
        getCompletedDownloads,
        getFailedDownloads,
        getDownloadById,
        // For external components to trigger downloads
        startDownload: handleDownloadClick
    };

})();
