import './style.css';

// API Configuration
const API_BASE_URL = 'https://admin.kochimuzirisbiennale.org/api/events?getAll=true&limit=500&size=100&sort=-timeAndDate.startDate&depth=10';
const CORS_PROXY = 'https://cors.utilitytool.app/';

// Minimum date filter - only show events from this date onwards
const MIN_DATE = new Date('2025-12-12T00:00:00.000Z');

// Helper function to build proxied URL
function getProxiedUrl(url) {
    // Percent-encode the full URL and prefix with CORS proxy
    return CORS_PROXY + encodeURIComponent(url);
}

// State Management
let allEvents = [];
let filteredEvents = [];
let currentPage = 1;
let totalPages = 1;
let viewMode = 'list'; // 'list' or 'grid'
let filters = {
    search: '',
    eventType: '',
    venue: '',
    category: '',
    dateFrom: '',
    dateTo: ''
};

// DOM Elements
const searchInput = document.getElementById('search');
const eventTypeSelect = document.getElementById('eventType');
const venueSelect = document.getElementById('venue');
const categorySelect = document.getElementById('category');
const dateFromInput = document.getElementById('dateFrom');
const dateToInput = document.getElementById('dateTo');
const clearFiltersBtn = document.getElementById('clearFilters');
const eventsContainer = document.getElementById('eventsContainer');
const loadingDiv = document.getElementById('loading');
const errorDiv = document.getElementById('error');
const errorMessage = document.getElementById('errorMessage');
const emptyState = document.getElementById('emptyState');
const paginationDiv = document.getElementById('pagination');
const prevPageBtn = document.getElementById('prevPage');
const nextPageBtn = document.getElementById('nextPage');
const pageInfo = document.getElementById('pageInfo');

// Debounce function for search input
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Get sort date for an event
function getEventSortDate(event) {
    const timeAndDate = event.timeAndDate;
    if (!timeAndDate) return null;
    
    // If singleDayEvent is true, use date key
    if (timeAndDate.singleDayEvent === true) {
        return timeAndDate.date ? new Date(timeAndDate.date) : null;
    }
    
    // If singleDayEvent is false, use startDate
    if (timeAndDate.singleDayEvent === false) {
        return timeAndDate.startDate ? new Date(timeAndDate.startDate) : null;
    }
    
    // Fallback: try date, then startDate
    if (timeAndDate.date) {
        return new Date(timeAndDate.date);
    }
    if (timeAndDate.startDate) {
        return new Date(timeAndDate.startDate);
    }
    
    return null;
}

// Check if event has a valid date
function hasValidDate(event) {
    const timeAndDate = event.timeAndDate;
    if (!timeAndDate) return false;
    
    // Must have date key if singleDayEvent is true
    if (timeAndDate.singleDayEvent === true) {
        return !!timeAndDate.date;
    }
    
    // Must have startDate if singleDayEvent is false
    if (timeAndDate.singleDayEvent === false) {
        return !!timeAndDate.startDate;
    }
    
    // Fallback: check for date key
    return !!timeAndDate.date;
}

// Sort events by date
function sortEventsByDate(events) {
    return events.sort((a, b) => {
        const dateA = getEventSortDate(a);
        const dateB = getEventSortDate(b);
        
        // Events without dates go to the end
        if (!dateA && !dateB) return 0;
        if (!dateA) return 1;
        if (!dateB) return -1;
        
        // Sort by date (ascending - earliest first)
        return dateA - dateB;
    });
}

// Fetch events from API
async function fetchEvents(page = 1) {
    try {
        showLoading();
        hideError();
        
        // Since getAll=true is used, we fetch all events at once
        const proxiedUrl = getProxiedUrl(API_BASE_URL);
        const response = await fetch(proxiedUrl);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.docs && Array.isArray(data.docs)) {
            // Filter out events without valid dates
            const eventsWithDates = data.docs.filter(hasValidDate);
            
            // Filter out events before December 12, 2025
            const eventsAfterMinDate = eventsWithDates.filter(event => {
                const eventDate = getEventSortDate(event);
                return eventDate && eventDate >= MIN_DATE;
            });
            
            // Sort events by date
            allEvents = sortEventsByDate(eventsAfterMinDate);
            
            currentPage = data.page || page;
            totalPages = data.totalPages || 1;
            
            // Populate filter dropdowns
            populateFilters(allEvents);
            
            // Apply filters and render
            applyFilters();
        } else {
            throw new Error('Invalid data format received from API');
        }
    } catch (error) {
        console.error('Error fetching events:', error);
        showError(`Failed to load events: ${error.message}`);
        allEvents = [];
        filteredEvents = [];
        renderEvents([]);
    } finally {
        hideLoading();
    }
}

// Populate filter dropdowns with unique values
function populateFilters(events) {
    // Event Types
    const eventTypes = new Set();
    events.forEach(event => {
        if (event.eventType && event.eventType.title) {
            eventTypes.add(event.eventType.title);
        }
    });
    
    // Clear and populate event type dropdown
    eventTypeSelect.innerHTML = '<option value="">All Types</option>';
    Array.from(eventTypes).sort().forEach(type => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        eventTypeSelect.appendChild(option);
    });

    // Venues
    const venues = new Set();
    events.forEach(event => {
        if (event.entryDetails && event.entryDetails.venue && event.entryDetails.venue.place) {
            venues.add(event.entryDetails.venue.place);
        }
    });
    
    // Clear and populate venue dropdown
    venueSelect.innerHTML = '<option value="">All Venues</option>';
    Array.from(venues).sort().forEach(venue => {
        const option = document.createElement('option');
        option.value = venue;
        option.textContent = venue;
        venueSelect.appendChild(option);
    });

    // Categories
    const categories = new Set();
    events.forEach(event => {
        if (event.categories && event.categories.title) {
            categories.add(event.categories.title);
        }
    });
    
    // Clear and populate category dropdown
    categorySelect.innerHTML = '<option value="">All Categories</option>';
    Array.from(categories).sort().forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        categorySelect.appendChild(option);
    });
}

// Apply filters to events
function applyFilters() {
    filteredEvents = allEvents.filter(event => {
        // Search filter
        if (filters.search) {
            const searchTerm = filters.search.toLowerCase();
            const titleMatch = event.title?.toLowerCase().includes(searchTerm);
            const descMatch = event.shortDescription?.toLowerCase().includes(searchTerm);
            if (!titleMatch && !descMatch) return false;
        }

        // Event Type filter
        if (filters.eventType && event.eventType?.title !== filters.eventType) {
            return false;
        }

        // Venue filter
        if (filters.venue && event.entryDetails?.venue?.place !== filters.venue) {
            return false;
        }

        // Category filter
        if (filters.category && event.categories?.title !== filters.category) {
            return false;
        }

        // Date range filter
        if (filters.dateFrom || filters.dateTo) {
            const eventSortDate = getEventSortDate(event);
            if (!eventSortDate) return false;

            if (filters.dateFrom) {
                const fromDate = new Date(filters.dateFrom);
                fromDate.setHours(0, 0, 0, 0);
                if (eventSortDate < fromDate) return false;
            }

            if (filters.dateTo) {
                const toDate = new Date(filters.dateTo);
                toDate.setHours(23, 59, 59, 999);
                if (eventSortDate > toDate) return false;
            }
        }

        return true;
    });

    // Sort filtered events by date
    filteredEvents = sortEventsByDate(filteredEvents);

    renderEvents(filteredEvents);
}

// Render events to the DOM
function renderEvents(events) {
    eventsContainer.innerHTML = '';

    if (events.length === 0) {
        emptyState.classList.remove('hidden');
        paginationDiv.classList.add('hidden');
        return;
    }

    emptyState.classList.add('hidden');
    paginationDiv.classList.remove('hidden');

    // Update container classes based on view mode
    if (viewMode === 'list') {
        eventsContainer.className = 'flex flex-col gap-3 sm:gap-4 mb-6 sm:mb-8';
    } else {
        eventsContainer.className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 mb-6 sm:mb-8';
    }

    events.forEach(event => {
        const eventElement = viewMode === 'list' ? createEventListItem(event) : createEventCard(event);
        eventsContainer.appendChild(eventElement);
    });

    updatePagination();
}

// Get display date for an event
function getEventDisplayDate(event) {
    const timeAndDate = event.timeAndDate;
    if (!timeAndDate) return null;
    
    // If singleDayEvent is true, use date key
    if (timeAndDate.singleDayEvent === true && timeAndDate.date) {
        return timeAndDate.date;
    }
    
    // If singleDayEvent is false, use startDate and endDate
    if (timeAndDate.singleDayEvent === false) {
        if (timeAndDate.startDate && timeAndDate.endDate) {
            return {
                startDate: timeAndDate.startDate,
                endDate: timeAndDate.endDate
            };
        }
        if (timeAndDate.startDate) {
            return timeAndDate.startDate;
        }
    }
    
    // Fallback: try date, then startDate
    if (timeAndDate.date) {
        return timeAndDate.date;
    }
    if (timeAndDate.startDate) {
        return timeAndDate.startDate;
    }
    
    return null;
}

// Format date for display (compact on mobile)
function formatDate(event, isMobile = false) {
    const dateValue = getEventDisplayDate(event);
    if (!dateValue) return 'Date TBA';
    
    // Handle date range (when singleDayEvent is false)
    if (typeof dateValue === 'object' && dateValue.startDate && dateValue.endDate) {
        const startDate = new Date(dateValue.startDate);
        const endDate = new Date(dateValue.endDate);
        
        if (isMobile) {
            // Compact format: "Dec 15 - 20, 2025"
            const startStr = startDate.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric'
            });
            const endStr = endDate.toLocaleDateString('en-US', {
                month: startDate.getMonth() === endDate.getMonth() ? undefined : 'short',
                day: 'numeric',
                year: 'numeric'
            });
            return `${startStr} - ${endStr}`;
        } else {
            // Full format: "Dec 15, 2025, 2:30 PM - Dec 20, 2025, 5:30 PM"
            const startStr = startDate.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            const endStr = endDate.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            return `${startStr} - ${endStr}`;
        }
    }
    
    // Handle single date
    const date = new Date(dateValue);
    if (isMobile) {
        // Compact format for mobile: "Dec 15, 2025"
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    } else {
        // Full format for desktop
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}

// Create event list item element (list view)
function createEventListItem(event) {
    const item = document.createElement('div');
    item.className = 'bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md active:shadow-lg transition-shadow touch-manipulation border border-gray-200';

    // Thumbnail
    const thumbnailUrl = event.thumbnail?.url 
        ? `https://admin.kochimuzirisbiennale.org${event.thumbnail.url}`
        : 'https://via.placeholder.com/400x300?text=No+Image';

    // Format date - detect mobile
    const isMobile = window.innerWidth < 640;
    const eventDate = formatDate(event, isMobile);

    // Venue
    const venue = event.entryDetails?.venue?.place || 'Venue TBA';

    // Event Type
    const eventType = event.eventType?.title || 'Event';

    item.innerHTML = `
        <div class="flex flex-col sm:flex-row">
            <div class="w-full sm:w-48 lg:w-64 flex-shrink-0 aspect-video sm:aspect-auto sm:h-auto">
                <img 
                    src="${thumbnailUrl}" 
                    alt="${event.title || 'Event image'}"
                    class="w-full h-full object-cover"
                    loading="lazy"
                    onerror="this.src='https://via.placeholder.com/400x300?text=No+Image'"
                >
            </div>
            <div class="flex-1 p-3 sm:p-4 flex flex-col">
                <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                            ${eventType}
                        </span>
                        <span class="text-xs text-gray-500">${eventDate}</span>
                    </div>
                </div>
                <h3 class="text-base sm:text-lg font-semibold text-gray-900 mb-2 line-clamp-2 leading-tight">
                    ${event.title || 'Untitled Event'}
                </h3>
                ${event.shortDescription ? `
                    <p class="text-sm text-gray-600 mb-3 line-clamp-2 sm:line-clamp-3 leading-snug flex-1">
                        ${event.shortDescription}
                    </p>
                ` : ''}
                <div class="flex items-center text-sm text-gray-500 mb-2">
                    <svg class="w-4 h-4 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                    </svg>
                    <span class="truncate">${venue}</span>
                </div>
                ${event.redirectURL?.redirectTo ? `
                    <a 
                        href="${event.redirectURL.redirectTo}" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        class="mt-auto inline-block text-sm text-blue-600 hover:text-blue-800 active:text-blue-900 font-medium touch-manipulation"
                    >
                        Learn More →
                    </a>
                ` : ''}
            </div>
        </div>
    `;

    return item;
}

// Create event card element (grid view)
function createEventCard(event) {
    const card = document.createElement('div');
    card.className = 'bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md active:shadow-lg transition-shadow touch-manipulation';

    // Thumbnail
    const thumbnailUrl = event.thumbnail?.url 
        ? `https://admin.kochimuzirisbiennale.org${event.thumbnail.url}`
        : 'https://via.placeholder.com/400x300?text=No+Image';

    // Format date - detect mobile
    const isMobile = window.innerWidth < 640;
    const eventDate = formatDate(event, isMobile);

    // Venue
    const venue = event.entryDetails?.venue?.place || 'Venue TBA';

    // Event Type
    const eventType = event.eventType?.title || 'Event';

    card.innerHTML = `
        <div class="aspect-video sm:aspect-[16/10] overflow-hidden bg-gray-200">
            <img 
                src="${thumbnailUrl}" 
                alt="${event.title || 'Event image'}"
                class="w-full h-full object-cover"
                loading="lazy"
                onerror="this.src='https://via.placeholder.com/400x300?text=No+Image'"
            >
        </div>
        <div class="p-3 sm:p-4">
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2 mb-2">
                <span class="px-2 py-0.5 sm:py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded self-start">
                    ${eventType}
                </span>
                <span class="text-xs text-gray-500">${eventDate}</span>
            </div>
            <h3 class="text-sm sm:text-base lg:text-lg font-semibold text-gray-900 mb-1 sm:mb-2 line-clamp-2 leading-tight">
                ${event.title || 'Untitled Event'}
            </h3>
            ${event.shortDescription ? `
                <p class="text-xs sm:text-sm text-gray-600 mb-2 sm:mb-3 line-clamp-2 leading-snug">
                    ${event.shortDescription}
                </p>
            ` : ''}
            <div class="flex items-center text-xs sm:text-sm text-gray-500">
                <svg class="w-3 h-3 sm:w-4 sm:h-4 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                </svg>
                <span class="truncate">${venue}</span>
            </div>
            ${event.redirectURL?.redirectTo ? `
                <a 
                    href="${event.redirectURL.redirectTo}" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    class="mt-2 sm:mt-3 inline-block text-xs sm:text-sm text-blue-600 hover:text-blue-800 active:text-blue-900 font-medium touch-manipulation"
                >
                    Learn More →
                </a>
            ` : ''}
        </div>
    `;

    return card;
}

// Update pagination UI
function updatePagination() {
    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage === totalPages;
}

// Navigation handlers
function goToPage(page) {
    if (page >= 1 && page <= totalPages) {
        fetchEvents(page);
    }
}

// Show/hide loading state
function showLoading() {
    loadingDiv.classList.remove('hidden');
    eventsContainer.classList.add('hidden');
}

function hideLoading() {
    loadingDiv.classList.add('hidden');
    eventsContainer.classList.remove('hidden');
}

// Show/hide error state
function showError(message) {
    errorMessage.textContent = message;
    errorDiv.classList.remove('hidden');
}

function hideError() {
    errorDiv.classList.add('hidden');
}

// Clear all filters
function clearFilters() {
    filters = {
        search: '',
        eventType: '',
        venue: '',
        category: '',
        dateFrom: '',
        dateTo: ''
    };
    
    searchInput.value = '';
    eventTypeSelect.value = '';
    venueSelect.value = '';
    categorySelect.value = '';
    dateFromInput.value = '';
    dateToInput.value = '';
    
    applyFilters();
}

// Event Listeners
searchInput.addEventListener('input', debounce((e) => {
    filters.search = e.target.value;
    applyFilters();
}, 300));

eventTypeSelect.addEventListener('change', (e) => {
    filters.eventType = e.target.value;
    applyFilters();
});

venueSelect.addEventListener('change', (e) => {
    filters.venue = e.target.value;
    applyFilters();
});

categorySelect.addEventListener('change', (e) => {
    filters.category = e.target.value;
    applyFilters();
});

dateFromInput.addEventListener('change', (e) => {
    filters.dateFrom = e.target.value;
    applyFilters();
});

dateToInput.addEventListener('change', (e) => {
    filters.dateTo = e.target.value;
    applyFilters();
});

clearFiltersBtn.addEventListener('click', clearFilters);

prevPageBtn.addEventListener('click', () => {
    if (currentPage > 1) {
        goToPage(currentPage - 1);
    }
});

nextPageBtn.addEventListener('click', () => {
    if (currentPage < totalPages) {
        goToPage(currentPage + 1);
    }
});

// Mobile filters toggle
const filtersToggle = document.getElementById('filtersToggle');
const filtersContent = document.getElementById('filtersContent');
const filtersToggleIcon = document.getElementById('filtersToggleIcon');

if (filtersToggle && filtersContent) {
    filtersToggle.addEventListener('click', () => {
        const isHidden = filtersContent.classList.contains('hidden');
        if (isHidden) {
            filtersContent.classList.remove('hidden');
            filtersToggleIcon.classList.add('rotate-180');
        } else {
            filtersContent.classList.add('hidden');
            filtersToggleIcon.classList.remove('rotate-180');
        }
    });
}

// Handle window resize to update date formats and filter visibility
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        // Show filters on desktop automatically
        if (window.innerWidth >= 640 && filtersContent) {
            filtersContent.classList.remove('hidden');
            if (filtersToggleIcon) {
                filtersToggleIcon.classList.remove('rotate-180');
            }
        }
        
        // Re-render events with updated date format
        if (filteredEvents.length > 0) {
            renderEvents(filteredEvents);
        }
    }, 250);
});

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    fetchEvents(1);
});

