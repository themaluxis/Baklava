/**
 * Media Requests - Consolidated
 * Combines: request-manager.js, requests-menu.js, requests-header-button.js
 * Manages user media requests with header button, dropdown menu, and full page views
 */
(function() {
    'use strict';
    
    console.log('[Requests] Loading consolidated module...');

    // ============================================
    // SHARED STATE & CONFIGURATION
    // ============================================
    
    const API_BASE = 'api/myplugin/requests';
    let isAdmin = false;
    let currentUsername = '';
    let isLoadingRequests = false;
    
    // UI References
    let dropdownMenu = null;
    let backdrop = null;

    // ============================================
    // UTILITY FUNCTIONS
    // ============================================

    async function checkAdmin() {
        if (!window.ApiClient) {
            console.warn('[Requests] ApiClient not available yet');
            return false;
        }
        
        try {
            const userId = window.ApiClient.getCurrentUserId();
            const user = await window.ApiClient.getUser(userId);
            isAdmin = user?.Policy?.IsAdministrator || false;
            currentUsername = user?.Name || 'Unknown';
            console.log('[Requests] User:', currentUsername, 'isAdmin:', isAdmin);
            return isAdmin;
        } catch (err) {
            console.error('[Requests] Error checking admin status (trying fallback):', err);
            // Try getCurrentUser as fallback
            try {
                const user = await window.ApiClient.getCurrentUser();
                isAdmin = user?.Policy?.IsAdministrator || false;
                currentUsername = user?.Name || 'Unknown';
                console.log('[Requests] Fallback - User:', currentUsername, 'isAdmin:', isAdmin);
                return isAdmin;
            } catch (fallbackErr) {
                console.error('[Requests] Fallback error:', fallbackErr);
                return false;
            }
        }
    }

    async function getCurrentUsername() {
        if (!window.ApiClient) {
            console.warn('[Requests.getCurrentUsername] ApiClient not available yet');
            return 'Unknown';
        }
        
        try {
            const userId = window.ApiClient.getCurrentUserId();
            const user = await window.ApiClient.getUser(userId);
            const username = user?.Name || 'Unknown';
            console.log('[Requests.getCurrentUsername] Retrieved username:', username, 'for userId:', userId);
            return username;
        } catch (err) {
            console.error('[Requests.getCurrentUsername] Error:', err);
            // Try to get from current user context as fallback
            try {
                const currentUser = await window.ApiClient.getCurrentUser();
                const username = currentUser?.Name || 'Unknown';
                console.log('[Requests.getCurrentUsername] Fallback username:', username);
                return username;
            } catch (fallbackErr) {
                console.error('[Requests.getCurrentUsername] Fallback error:', fallbackErr);
                return 'Unknown';
            }
        }
    }

    // ============================================
    // API FUNCTIONS
    // ============================================

    async function fetchAllRequests() {
        try {
            const response = await window.ApiClient.ajax({
                type: 'GET',
                url: window.ApiClient.getUrl(API_BASE),
                dataType: 'json'
            });
            return Array.isArray(response) ? response : [];
        } catch (err) {
            console.error('[Requests.fetchAllRequests] Error:', err);
            return [];
        }
    }

    async function saveRequest(item) {
        const username = await getCurrentUsername();
        const userId = window.ApiClient.getCurrentUserId();
        
        const request = {
            title: item.title,
            year: item.year,
            img: item.img,
            imdbId: item.imdbId,
            tmdbId: item.tmdbId,
            itemType: item.itemType,
            jellyfinId: item.jellyfinId,
            status: 'pending',
            username: username,
            userId: userId,
            requestedAt: new Date().toISOString()
        };

        await window.ApiClient.ajax({
            type: 'POST',
            url: window.ApiClient.getUrl(API_BASE),
            data: JSON.stringify(request),
            contentType: 'application/json',
            dataType: 'json'
        });
    }

    async function updateRequestStatus(requestId, status) {
        await window.ApiClient.ajax({
            type: 'PATCH',
            url: window.ApiClient.getUrl(`${API_BASE}/${requestId}`),
            data: JSON.stringify({ status }),
            contentType: 'application/json',
            dataType: 'json'
        });
    }

    async function deleteRequest(requestId) {
        await window.ApiClient.ajax({
            type: 'DELETE',
            url: window.ApiClient.getUrl(`${API_BASE}/${requestId}`)
        });
    }

    // ============================================
    // CARD CREATION
    // ============================================

    async function createRequestCard(request, adminView) {
        const card = document.createElement('div');
        card.className = 'request-card';
        card.dataset.requestId = request.id;
        card.style.cssText = `
            display: inline-block;
            width: 140px;
            margin: 10px;
            cursor: pointer;
            text-align: center;
            color: #ccc;
            position: relative;
        `;

        const imgDiv = document.createElement('div');
        imgDiv.style.cssText = `
            width: 100%;
            height: 210px;
            background-size: cover;
            background-position: center;
            border-radius: 6px;
            margin-bottom: 8px;
        `;
        imgDiv.style.backgroundImage = request.img;
        card.appendChild(imgDiv);

        if (adminView && request.username) {
            const userBadge = document.createElement('div');
            userBadge.textContent = request.username;
            userBadge.style.cssText = `
                position: absolute;
                top: 8px;
                left: 8px;
                background: rgba(30, 144, 255, 0.9);
                color: #fff;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 11px;
                font-weight: 600;
                max-width: 120px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            `;
            card.appendChild(userBadge);
        }

        if (request.status === 'pending') {
            const statusBadge = document.createElement('div');
            statusBadge.textContent = 'Pending';
            statusBadge.style.cssText = `
                position: absolute;
                top: 8px;
                right: 8px;
                background: rgba(255, 152, 0, 0.9);
                color: #fff;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 11px;
                font-weight: 600;
            `;
            card.appendChild(statusBadge);
        }

        const titleDiv = document.createElement('div');
        titleDiv.textContent = request.title || 'Unknown';
        titleDiv.style.cssText = `
            font-size: 13px;
            font-weight: 500;
            margin-bottom: 4px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        `;
        card.appendChild(titleDiv);

        const yearDiv = document.createElement('div');
        yearDiv.textContent = request.year || '';
        yearDiv.style.cssText = `
            font-size: 12px;
            color: #999;
        `;
        card.appendChild(yearDiv);

        card.addEventListener('click', () => {
            openRequestModal(request, adminView);
        });

        return card;
    }

    function openRequestModal(request, adminView) {
        const currentUserName = currentUsername;
        const isOwnRequest = request.username === currentUserName;
        
        document.dispatchEvent(new CustomEvent('openDetailsModal', {
            detail: {
                item: {
                    Name: request.title,
                    ProductionYear: request.year,
                    tmdbId: request.tmdbId,
                    imdbId: request.imdbId,
                    itemType: request.itemType,
                    jellyfinId: request.jellyfinId
                },
                isRequestMode: true,
                requestId: request.id,
                requestUsername: request.username,
                requestStatus: request.status,
                isAdmin: adminView,
                isOwnRequest: isOwnRequest
            }
        }));
    }

    // ============================================
    // HEADER DROPDOWN MENU
    // ============================================

    function createBackdrop() {
        if (backdrop) return backdrop;
        
        backdrop = document.createElement('div');
        backdrop.className = 'requests-backdrop';
        backdrop.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            z-index: 9999;
            display: none;
        `;
        
        backdrop.addEventListener('click', () => {
            hideDropdown();
        });
        
        document.body.appendChild(backdrop);
        return backdrop;
    }

    function createDropdown() {
        if (dropdownMenu) return dropdownMenu;
        
        dropdownMenu = document.createElement('div');
        dropdownMenu.className = 'requests-dropdown';
        dropdownMenu.style.cssText = `
            position: fixed;
            top: 60px;
            right: 20px;
            left: 20px;
            max-width: 1400px;
            margin: 0 auto;
            max-height: 70vh;
            background: #181818;
            border: 1px solid #333;
            border-radius: 8px;
            box-shadow: 0 4px 16px rgba(0,0,0,0.5);
            z-index: 10000;
            display: none;
            overflow: hidden;
            padding: 20px;
        `;
        
        dropdownMenu.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 10px;">
                <h2 style="margin: 0; color: #fff;">Media Requests</h2>
                <button class="close-dropdown" style="background: #555; border: none; color: #fff; padding: 8px 16px; border-radius: 4px; cursor: pointer;">Close</button>
            </div>
            <div class="dropdown-content" style="overflow-y: auto; max-height: calc(70vh - 80px);">
                <div class="dropdown-movies">
                    <h3 style="color: #1e90ff; margin-bottom: 10px;">Movie Requests</h3>
                    <div class="dropdown-movies-container" style="display: flex; flex-wrap: wrap; min-height: 50px;"></div>
                </div>
                <div class="dropdown-series" style="margin-top: 30px;">
                    <h3 style="color: #1e90ff; margin-bottom: 10px;">Series Requests</h3>
                    <div class="dropdown-series-container" style="display: flex; flex-wrap: wrap; min-height: 50px;"></div>
                </div>
            </div>
        `;
        
        document.body.appendChild(dropdownMenu);
        
        dropdownMenu.querySelector('.close-dropdown').addEventListener('click', hideDropdown);
        
        return dropdownMenu;
    }

    async function loadDropdownRequests() {
        if (isLoadingRequests) return;
        isLoadingRequests = true;

        const dropdown = createDropdown();
        const moviesContainer = dropdown.querySelector('.dropdown-movies-container');
        const seriesContainer = dropdown.querySelector('.dropdown-series-container');

        moviesContainer.innerHTML = '<div style="color: #999; padding: 20px;">Loading...</div>';
        seriesContainer.innerHTML = '<div style="color: #999; padding: 20px;">Loading...</div>';

        try {
            const requests = await fetchAllRequests();
            const adminView = await checkAdmin();
            
            const filteredRequests = adminView ? requests : requests.filter(r => r.username === currentUsername);
            
            const movies = filteredRequests.filter(r => r.itemType === 'movie');
            const series = filteredRequests.filter(r => r.itemType === 'series');

            moviesContainer.innerHTML = '';
            seriesContainer.innerHTML = '';

            if (movies.length === 0) {
                moviesContainer.innerHTML = '<div style="color: #999; padding: 20px;">No movie requests</div>';
            } else {
                for (const req of movies) {
                    moviesContainer.appendChild(await createRequestCard(req, adminView));
                }
            }

            if (series.length === 0) {
                seriesContainer.innerHTML = '<div style="color: #999; padding: 20px;">No series requests</div>';
            } else {
                for (const req of series) {
                    seriesContainer.appendChild(await createRequestCard(req, adminView));
                }
            }
        } catch (err) {
            console.error('[Requests.loadDropdownRequests] Error:', err);
            moviesContainer.innerHTML = '<div style="color: #f44336; padding: 20px;">Error loading requests</div>';
            seriesContainer.innerHTML = '<div style="color: #f44336; padding: 20px;">Error loading requests</div>';
        } finally {
            isLoadingRequests = false;
        }
    }

    function showDropdown() {
        createBackdrop();
        createDropdown();
        loadDropdownRequests();
        backdrop.style.display = 'block';
        dropdownMenu.style.display = 'block';
    }

    function hideDropdown() {
        if (backdrop) backdrop.style.display = 'none';
        if (dropdownMenu) dropdownMenu.style.display = 'none';
    }

    function toggleDropdown(btn) {
        if (dropdownMenu && dropdownMenu.style.display === 'block') {
            hideDropdown();
        } else {
            showDropdown();
        }
    }

    // ============================================
    // HEADER BUTTON
    // ============================================

    function addRequestsButton() {
        const headerRight = document.querySelector('.headerRight');
        if (!headerRight) {
            setTimeout(addRequestsButton, 500);
            return;
        }
        
        if (document.querySelector('.headerRequestsButton')) {
            return;
        }
        
        const btn = document.createElement('button');
        btn.setAttribute('is', 'paper-icon-button-light');
        btn.className = 'headerButton headerButtonRight headerRequestsButton paper-icon-button-light';
        btn.title = 'Media Requests';
        btn.innerHTML = '<span class="material-icons list_alt" aria-hidden="true"></span>';
        
        const userButton = headerRight.querySelector('.headerUserButton');
        if (userButton) {
            headerRight.insertBefore(btn, userButton);
        } else {
            headerRight.appendChild(btn);
        }
        
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleDropdown(btn);
        });
        
        console.log('[Requests] Header button added');
    }

    // ============================================
    // USER MENU ITEM
    // ============================================

    function addRequestsMenuItem() {
        const userMenuSection = document.querySelector('.verticalSection .headerUsername');
        if (!userMenuSection) return false;

        const container = userMenuSection.parentElement;
        if (!container) return false;

        if (container.querySelector('.lnkMediaRequests')) return true;

        const requestsLink = document.createElement('a');
        requestsLink.className = 'emby-button lnkMediaRequests listItem-border';
        requestsLink.href = '#';
        requestsLink.style.cssText = 'display: block; margin: 0px; padding: 0px;';
        
        requestsLink.innerHTML = `
            <div class="listItem">
                <span class="material-icons listItemIcon listItemIcon-transparent movie_filter" aria-hidden="true"></span>
                <div class="listItemBody">
                    <div class="listItemBodyText">Media Requests</div>
                </div>
            </div>
        `;

        requestsLink.addEventListener('click', (e) => {
            e.preventDefault();
            showRequestsPage();
            const userMenuButton = document.querySelector('.headerUserButton');
            if (userMenuButton) userMenuButton.click();
        });

        const quickConnect = container.querySelector('.lnkQuickConnectPreferences');
        if (quickConnect) {
            quickConnect.parentNode.insertBefore(requestsLink, quickConnect.nextSibling);
        } else {
            container.appendChild(requestsLink);
        }

        console.log('[Requests] Menu item added');
        return true;
    }

    // ============================================
    // FULL REQUESTS PAGE
    // ============================================

    function createRequestsPage() {
        const oldPage = document.getElementById('requestsPage');
        if (oldPage) oldPage.remove();

        const requestsPage = document.createElement('div');
        requestsPage.id = 'requestsPage';
        requestsPage.className = 'page type-interior';
        requestsPage.setAttribute('data-role', 'page');
        requestsPage.style.cssText = 'display:none;';
        
        requestsPage.innerHTML = `
            <div class="skinHeader focuscontainer-x padded-top padded-left padded-right padded-bottom-page">
                <div class="flex align-items-center flex-grow headerTop">
                    <div class="flex align-items-center flex-grow">
                        <h1 class="pageTitle">Media Requests</h1>
                    </div>
                </div>
            </div>
            <div class="padded-left padded-right padded-top padded-bottom-page">
                <div class="verticalSection">
                    <h2 class="sectionTitle sectionTitle-cards padded-left">Movie Requests</h2>
                    <div class="requests-movies-panel">
                        <div class="itemsContainer scrollSlider focuscontainer-x padded-left padded-right" style="white-space:nowrap;overflow-x:auto;"></div>
                    </div>
                </div>
                <div class="verticalSection" style="margin-top:3em;">
                    <h2 class="sectionTitle sectionTitle-cards padded-left">Series Requests</h2>
                    <div class="requests-series-panel">
                        <div class="itemsContainer scrollSlider focuscontainer-x padded-left padded-right" style="white-space:nowrap;overflow-x:auto;"></div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(requestsPage);
        console.log('[Requests] Page created');
    }

    function showRequestsPage() {
        document.querySelectorAll('.page').forEach(p => {
            if (p.id !== 'requestsPage') {
                p.style.display = 'none';
            }
        });
        
        let requestsPage = document.getElementById('requestsPage');
        if (!requestsPage) {
            createRequestsPage();
            requestsPage = document.getElementById('requestsPage');
        }
        
        requestsPage.style.display = 'block';
        loadAndDisplayRequestsPage();
    }

    async function loadAndDisplayRequestsPage() {
        const page = document.getElementById('requestsPage');
        if (!page) return;

        const moviesContainer = page.querySelector('.requests-movies-panel .itemsContainer');
        const seriesContainer = page.querySelector('.requests-series-panel .itemsContainer');

        moviesContainer.innerHTML = '<div style="color: #999; padding: 20px;">Loading...</div>';
        seriesContainer.innerHTML = '<div style="color: #999; padding: 20px;">Loading...</div>';

        try {
            const requests = await fetchAllRequests();
            const adminView = await checkAdmin();
            
            const filteredRequests = adminView ? requests : requests.filter(r => r.username === currentUsername);
            
            const movies = filteredRequests.filter(r => r.itemType === 'movie');
            const series = filteredRequests.filter(r => r.itemType === 'series');

            moviesContainer.innerHTML = '';
            seriesContainer.innerHTML = '';

            if (movies.length === 0) {
                moviesContainer.innerHTML = '<div style="color: #999; padding: 20px;">No movie requests</div>';
            } else {
                for (const req of movies) {
                    moviesContainer.appendChild(await createRequestCard(req, adminView));
                }
            }

            if (series.length === 0) {
                seriesContainer.innerHTML = '<div style="color: #999; padding: 20px;">No series requests</div>';
            } else {
                for (const req of series) {
                    seriesContainer.appendChild(await createRequestCard(req, adminView));
                }
            }
        } catch (err) {
            console.error('[Requests.loadRequestsPage] Error:', err);
            moviesContainer.innerHTML = '<div style="color: #f44336; padding: 20px;">Error loading requests</div>';
            seriesContainer.innerHTML = '<div style="color: #f44336; padding: 20px;">Error loading requests</div>';
        }
    }

    // ============================================
    // EVENT LISTENERS
    // ============================================

    document.addEventListener('mediaRequest', async (e) => {
        console.log('[Requests] mediaRequest event received:', e.detail);
        const item = e.detail;
        try {
            await saveRequest(item);
            console.log('[Requests] Request saved successfully');
            // Reload both dropdown and page if visible
            if (dropdownMenu && dropdownMenu.style.display === 'block') {
                await loadDropdownRequests();
            }
            if (document.getElementById('requestsPage')?.style.display === 'block') {
                await loadAndDisplayRequestsPage();
            }
        } catch (err) {
            console.error('[Requests] Error saving request:', err);
        }
    });

    // ============================================
    // EXPORTS
    // ============================================

    window.RequestManager = {
        updateStatus: async (requestId, status) => {
            await updateRequestStatus(requestId, status);
            if (dropdownMenu && dropdownMenu.style.display === 'block') {
                await loadDropdownRequests();
            }
            if (document.getElementById('requestsPage')?.style.display === 'block') {
                await loadAndDisplayRequestsPage();
            }
        },
        deleteRequest: async (requestId) => {
            await deleteRequest(requestId);
            if (dropdownMenu && dropdownMenu.style.display === 'block') {
                await loadDropdownRequests();
            }
            if (document.getElementById('requestsPage')?.style.display === 'block') {
                await loadAndDisplayRequestsPage();
            }
        }
    };

    window.RequestsHeaderButton = {
        reload: async () => {
            if (dropdownMenu && dropdownMenu.style.display === 'block') {
                await loadDropdownRequests();
            }
            if (document.getElementById('requestsPage')?.style.display === 'block') {
                await loadAndDisplayRequestsPage();
            }
        }
    };

    // ============================================
    // INITIALIZATION
    // ============================================

    function init() {
        console.log('[Requests] Initializing consolidated module...');
        
        // Wait for ApiClient to be ready before checking admin
        const waitForApiClient = () => {
            if (window.ApiClient) {
                checkAdmin();
            } else {
                setTimeout(waitForApiClient, 100);
            }
        };
        waitForApiClient();
        
        // Add header button
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', addRequestsButton);
        } else {
            addRequestsButton();
        }
        
        // Add menu item (retry pattern for dynamic UI)
        const tryAddMenuItem = () => {
            if (!addRequestsMenuItem()) {
                setTimeout(tryAddMenuItem, 1000);
            }
        };
        setTimeout(tryAddMenuItem, 1000);
        
        console.log('[Requests] Consolidated module loaded');
    }

    // Start initialization
    init();
})();
