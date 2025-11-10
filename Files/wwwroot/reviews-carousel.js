/**
 * Reviews Carousel - Standalone
 * Adds a TMDB reviews carousel above "Cast & Crew" section on item details pages
 * Works with both card mode and select mode
 */
(function () {
    'use strict';

    console.log('[ReviewsCarousel] Loading...');

    let currentItemId = null;

    async function fetchTMDBReviews(itemId) {
        try {
            const item = await window.ApiClient.getItem(window.ApiClient.getCurrentUserId(), itemId);
            if (!item) {
                console.warn('[ReviewsCarousel] Could not fetch item');
                return null;
            }

            const tmdbId = item.ProviderIds?.Tmdb;
            const imdbId = item.ProviderIds?.Imdb;
            const itemType = item.Type === 'Series' ? 'series' : 'movie';

            if (!tmdbId && !imdbId) {
                console.log('[ReviewsCarousel] No TMDB/IMDB ID found');
                return null;
            }

            console.log('[ReviewsCarousel] Fetching reviews for itemType:', itemType, 'tmdbId:', tmdbId, 'imdbId:', imdbId);

            const params = new URLSearchParams();
            if (tmdbId) params.append('tmdbId', tmdbId);
            if (imdbId) params.append('imdbId', imdbId);
            params.append('itemType', itemType);
            params.append('includeCredits', 'false');
            params.append('includeReviews', 'true');

            const url = window.ApiClient.getUrl('api/baklava/metadata/tmdb') + '?' + params;
            const response = await window.ApiClient.ajax({
                type: 'GET',
                url: url,
                dataType: 'json'
            });

            const reviews = response?.reviews?.results || [];
            console.log('[ReviewsCarousel] Found', reviews.length, 'reviews');
            return reviews;
        } catch (err) {
            console.error('[ReviewsCarousel] Error fetching reviews:', err);
            return null;
        }
    }

    function createReviewsCarousel(reviews) {
        if (!reviews || reviews.length === 0) {
            console.log('[ReviewsCarousel] No reviews to display');
            return;
        }

        const castCollapsible = document.querySelector('#castCollapsible');
        if (!castCollapsible) {
            console.warn('[ReviewsCarousel] Could not find #castCollapsible');
            return;
        }

        // Check if already created
        if (document.querySelector('.baklava-reviews-carousel')) {
            console.log('[ReviewsCarousel] Carousel already exists');
            return;
        }

        console.log('[ReviewsCarousel] Creating carousel with', reviews.length, 'reviews');

        const wrapper = document.createElement('div');
        wrapper.className = 'baklava-reviews-carousel';
        wrapper.style.cssText = 'margin: 2rem 8rem 0 8rem; padding: 1.5rem; border-radius: 8px; height: 400px; display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; align-items: space-between;';

        let html = '<div style="font-size: 1.3em; font-weight: 500; color: rgba(255,255,255,0.9); margin-bottom: 1rem;">Reviews</div>';
        html += '<div style="position: relative; padding: 0 50px;">';
        html += '<button class="baklava-review-prev" style="position: absolute; left: 0; top: 50%; z-index: 10; background: rgba(128, 128, 128, 0.5); border: none; color: #fff; width: 40px; height: 40px; border-radius: 50%; cursor: pointer; transform: translateY(-50%); font-size: 24px;">‹</button>';
        html += '<button class="baklava-review-next" style="position: absolute; right: 0; top: 50%; z-index: 10; background: rgba(128, 128, 128, 0.5); border: none; color: #fff; width: 40px; height: 40px; border-radius: 50%; cursor: pointer; transform: translateY(-50%); font-size: 24px;">›</button>';
        html += '<div class="baklava-review-track" style="display: flex; gap: 15px; transition: transform 0.3s ease; overflow: hidden;">';

        reviews.slice(0, 20).forEach(review => {
            const author = review.author || 'Anonymous';
            const content = review.content || '';
            const isTrunc = content.length > 200;
            const text = isTrunc ? content.substring(0, 200) + '...' : content;
            html += '<div class="baklava-review-card" style="background: rgba(255,255,255,0.05); padding: 1rem; height: 300px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1);' + (isTrunc ? ' cursor: pointer;' : '') + '">';
            html += '<div style="font-weight: bold; color: #fff; margin-bottom: 0.5rem;">' + escapeHtml(author) + '</div>';
            html += '<div style="color: #ccc; font-size: 13px; line-height: 1.5;">' + escapeHtml(text) + '</div>';
            html += '</div>';
        });

        html += '</div></div>';
        html += '<div class="baklava-review-dots" style="display: flex; justify-content: center; gap: 8px; margin-top: 1rem;"></div>';
        wrapper.innerHTML = html;

        castCollapsible.parentNode.insertBefore(wrapper, castCollapsible);

        // Create dots
        const dotsContainer = wrapper.querySelector('.baklava-review-dots');
        for (let i = 0; i < reviews.length; i++) {
            const dot = document.createElement('button');
            dot.style.cssText = 'width: 10px; height: 10px; border-radius: 50%; background: ' + (i === 0 ? '#1e90ff' : '#555') + '; border: none; cursor: pointer; padding: 0;';
            dot.addEventListener('click', () => { currentIdx = i; updateCarousel(); });
            dotsContainer.appendChild(dot);
        }

        const track = wrapper.querySelector('.baklava-review-track');
        const prevBtn = wrapper.querySelector('.baklava-review-prev');
        const nextBtn = wrapper.querySelector('.baklava-review-next');
        let currentIdx = 0;

        function updateCarousel() {
            const firstCard = track.querySelector('.baklava-review-card');
            if (firstCard) {
                const cardWidth = firstCard.offsetWidth;
                const gap = 15;
                const offset = currentIdx * (cardWidth + gap);
                track.style.transform = 'translateX(-' + offset + 'px)';
            }
            Array.from(dotsContainer.children).forEach((d, i) => {
                d.style.background = i === currentIdx ? '#1e90ff' : '#555';
            });
        }

        prevBtn.addEventListener('click', () => {
            if (currentIdx > 0) {
                currentIdx--;
                updateCarousel();
            }
        });

        nextBtn.addEventListener('click', () => {
            if (currentIdx < reviews.length - 1) {
                currentIdx++;
                updateCarousel();
            }
        });

        // Click on truncated reviews to show full content
        wrapper.querySelectorAll('.baklava-review-card').forEach((card, i) => {
            if (reviews[i] && reviews[i].content.length > 200) {
                card.addEventListener('click', () => {
                    showFullReview(reviews[i]);
                });
            }
        });

        console.log('[ReviewsCarousel] Carousel created successfully');
    }

    function showFullReview(review) {
        const popup = document.createElement('div');
        popup.className = 'baklava-review-popup';
        popup.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); z-index: 10000; display: flex; align-items: center; justify-content: center;';
        popup.innerHTML = '<div style="max-width: 800px; width: 90%; max-height: 80%; background: #1a1a1a; border-radius: 8px; padding: 2rem; overflow-y: auto;"><div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;"><h3 style="margin: 0; color: #fff;">Review by ' + escapeHtml(review.author) + '</h3><button style="background: #555; border: none; color: #fff; padding: 8px 12px; cursor: pointer; border-radius: 4px; font-size: 16px;">✕</button></div><div style="color: #ccc; line-height: 1.6;">' + escapeHtml(review.content) + '</div></div>';
        
        document.body.appendChild(popup);
        
        popup.querySelector('button').addEventListener('click', () => popup.remove());
        popup.addEventListener('click', (e) => { 
            if (e.target === popup) popup.remove(); 
        });
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function captureItemId() {
        // Try URL params
        const urlParams = new URLSearchParams(window.location.search);
        const urlId = urlParams.get('id');
        if (urlId) {
            currentItemId = urlId;
            console.log('[ReviewsCarousel] Captured itemId from URL params:', currentItemId);
            return true;
        }

        // Try URL hash
        const urlMatch = window.location.href.match(/[?&]id=([a-f0-9-]+)/i);
        if (urlMatch) {
            currentItemId = urlMatch[1].replace(/-/g, '');
            console.log('[ReviewsCarousel] Captured itemId from URL match:', currentItemId);
            return true;
        }

        console.warn('[ReviewsCarousel] No itemId found');
        return false;
    }

    async function initReviewsCarousel() {
        // Check server config first
        try {
            const configUrl = window.ApiClient.getUrl('api/baklava/config');
            const configResponse = await window.ApiClient.ajax({
                type: 'GET',
                url: configUrl,
                dataType: 'json'
            });
            
            if (configResponse?.showReviewsCarousel === false) {
                console.log('[ReviewsCarousel] Reviews disabled in server config');
                return;
            }
        } catch (err) {
            console.warn('[ReviewsCarousel] Could not load config, assuming enabled:', err);
        }

        // Check if reviews are disabled in localStorage (client-side toggle)
        const localToggle = localStorage.getItem('baklava_show_reviews');
        if (localToggle === 'false') {
            console.log('[ReviewsCarousel] Reviews disabled via localStorage');
            return;
        }

        if (!captureItemId()) {
            console.log('[ReviewsCarousel] Could not capture itemId, will retry on navigation');
            return;
        }

        if (!currentItemId) {
            console.log('[ReviewsCarousel] No itemId available');
            return;
        }

        const reviews = await fetchTMDBReviews(currentItemId);
        if (reviews && reviews.length > 0) {
            createReviewsCarousel(reviews);
        }
    }

    function start() {
        console.log('[ReviewsCarousel] Starting...');

        // Try to initialize immediately
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            setTimeout(initReviewsCarousel, 500);
        }

        // Also watch for DOM changes and page navigation
        const observer = new MutationObserver(() => {
            const castCollapsible = document.querySelector('#castCollapsible');
            if (castCollapsible && !document.querySelector('.baklava-reviews-carousel')) {
                if (captureItemId()) {
                    initReviewsCarousel();
                }
            }
        });

        observer.observe(document.body, { 
            childList: true, 
            subtree: true 
        });

        // Listen for hash changes (Jellyfin navigation)
        window.addEventListener('hashchange', () => {
            console.log('[ReviewsCarousel] Hash changed, will check for reviews');
            setTimeout(() => {
                const castCollapsible = document.querySelector('#castCollapsible');
                if (castCollapsible && !document.querySelector('.baklava-reviews-carousel')) {
                    initReviewsCarousel();
                }
            }, 1000);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
