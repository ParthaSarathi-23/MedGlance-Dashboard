// Medical Dashboard JavaScript - Complete Implementation
// Author: Dashboard Analytics Team
// Version: 2.0.1

// Copy to clipboard function
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        const event = window.event;
        const button = event.target.closest('.copy-code-btn');
        const originalText = button.textContent;
        button.textContent = 'Copied!';
        button.style.background = '#10b981';
        button.style.color = 'white';
        
        setTimeout(() => {
            button.textContent = originalText;
            button.style.background = '';
            button.style.color = '';
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy text: ', err);
        alert('Failed to copy to clipboard');
    });
}

// Global variables for charts and data
let charts = {};
let dashboardData = {};

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeDashboard();
    loadSampleQueries();
    initializeNavigation();
});

// Navigation System
function initializeNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const contentSections = document.querySelectorAll('.content-section');
    const breadcrumbItem = document.querySelector('.breadcrumb-item');
    const pageTitle = document.querySelector('.page-title');

    navItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Remove active class from all nav items and sections
            navItems.forEach(nav => nav.classList.remove('active'));
            contentSections.forEach(section => section.classList.remove('active'));
            
            // Add active class to clicked nav item
            this.classList.add('active');
            
            // Show corresponding section
            const sectionId = this.dataset.section + '-section';
            const targetSection = document.getElementById(sectionId);
            if (targetSection) {
                targetSection.classList.add('active');
            }
            
            // Update breadcrumb and page title
            const sectionName = this.querySelector('span').textContent;
            if (breadcrumbItem) breadcrumbItem.textContent = sectionName;
            if (pageTitle) pageTitle.textContent = sectionName + ' Dashboard';
            
            // Close sidebar on mobile
            if (window.innerWidth <= 1024) {
                document.querySelector('.sidebar').classList.remove('open');
            }
        });
    });

    // Mobile sidebar toggle
    const sidebarToggle = document.querySelector('.sidebar-toggle');
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', function() {
            document.querySelector('.sidebar').classList.toggle('open');
        });
    }

    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', function(e) {
        const sidebar = document.querySelector('.sidebar');
        const sidebarToggle = document.querySelector('.sidebar-toggle');
        
        if (window.innerWidth <= 1024 && 
            !sidebar.contains(e.target) && 
            !sidebarToggle.contains(e.target)) {
            sidebar.classList.remove('open');
        }
    });
}

// Sidebar collapse functionality
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    sidebar.classList.toggle('collapsed');
    
    // Save preference
    localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
}

// Restore sidebar state
function restoreSidebarState() {
    const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    if (isCollapsed) {
        document.querySelector('.sidebar').classList.add('collapsed');
    }
}

// Dark Mode functionality
function initializeDarkMode() {
    // Check for saved theme preference or default to light mode
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateDarkModeButton(savedTheme);
}

function toggleDarkMode() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateDarkModeButton(newTheme);
    
    // Add smooth transition effect
    document.body.style.transition = 'all 0.3s ease';
    setTimeout(() => {
        document.body.style.transition = '';
    }, 300);
    
    // Update charts with new theme
    setTimeout(() => {
        initializeCharts();
    }, 100);
    
    showNotification(
        `Switched to ${newTheme} mode`, 
        'success', 
        2000
    );
}

function updateDarkModeButton(theme) {
    const button = document.getElementById('dark-mode-toggle');
    const icon = button.querySelector('i');
    const text = button.querySelector('span');
    
    if (theme === 'dark') {
        icon.className = 'fas fa-sun';
        text.textContent = 'Light Mode';
        button.classList.add('dark-active');
    } else {
        icon.className = 'fas fa-moon';
        text.textContent = 'Dark Mode';
        button.classList.remove('dark-active');
    }
}

// Dashboard initialization
async function initializeDashboard() {
    // Initialize dark mode first
    initializeDarkMode();
    
    // Restore sidebar state
    restoreSidebarState();
    
    showLoadingOverlay();
    
    try {
        await loadAllData();
        initializeCharts();
        updateHeaderStats();
        updateLastUpdatedTime();
        
        // Show success notification
        showNotification('Dashboard loaded successfully', 'success', 3000);
    } catch (error) {
        console.error('Error initializing dashboard:', error);
        showNotification('Failed to load dashboard data', 'error');
    } finally {
        hideLoadingOverlay();
    }
}

// Load all dashboard data
async function loadAllData() {
    const endpoints = [
        'weekly-users',
        'user-queries', 
        'medicine-search',
        'daily-engagement',
        'demographics',
        'chat-sessions',
        'peak-hours',
        'retention',
        'response-times',
        'content-categories',
        'age-category-queries'
    ];

    const promises = endpoints.map(endpoint => 
        fetch(`/api/${endpoint}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Failed to fetch ${endpoint}: ${response.status}`);
                }
                return response.json();
            })
            .catch(error => {
                console.error(`Error loading ${endpoint}:`, error);
                return {};
            })
    );

    const results = await Promise.all(promises);
    
    // Store data in global object
    dashboardData = {
        weeklyUsers: results[0],
        userQueries: results[1],
        medicineSearch: results[2],
        dailyEngagement: results[3],
        demographics: results[4],
        chatSessions: results[5],
        peakHours: results[6],
        retention: results[7],
        responseTimes: results[8],
        contentCategories: results[9],
        ageCategoryQueries: results[10]
    };

    // Update UI components
    updateQuickStats();
    updateTables();
    updateMetrics();
}

// Update quick stats cards
function updateQuickStats() {
    const { weeklyUsers, userQueries, medicineSearch, responseTimes, demographics } = dashboardData;
    
    console.log('📊 Updating quick stats...');
    console.log('Demographics data:', demographics);
    
    // Weekly active users
    document.getElementById('weekly-active-users').textContent = weeklyUsers.count || 0;
    document.getElementById('weekly-trend').textContent = `${weeklyUsers.count || 0} users`;
    
    // Average queries per user
    document.getElementById('avg-queries-per-user').textContent = userQueries.average_queries_per_user || 0;
    document.getElementById('query-trend').textContent = `${userQueries.total_queries || 0} total`;
    
    // Medicine searches
    const totalMedicineSearches = medicineSearch.medicine_statistics ? 
        medicineSearch.medicine_statistics.reduce((sum, med) => sum + med.search_count, 0) : 0;
    document.getElementById('medicine-searches').textContent = totalMedicineSearches;
    document.getElementById('medicine-trend').textContent = `${medicineSearch.total_medicines_searched || 0} medicines`;
    
    // Average response time
    document.getElementById('avg-response-time').textContent = `${responseTimes.average_response_time || 0}s`;
    document.getElementById('response-trend').textContent = `${responseTimes.total_responses || 0} responses`;
}

// Update header statistics
function updateHeaderStats() {
    const { userQueries, demographics } = dashboardData;
    
    document.getElementById('total-users').textContent = demographics.total_users || 0;
    document.getElementById('total-queries').textContent = userQueries.total_queries || 0;
}

// Update last updated time
function updateLastUpdatedTime() {
    const now = new Date();
    document.getElementById('last-updated').textContent = now.toLocaleTimeString();
}

// Initialize all charts
function initializeCharts() {
    initializeDailyEngagementChart();
    initializePeakHoursChart();
    initializeDemographicsChart();
    initializeContentCategoriesChart();
    initializeAgeCategoryQueriesChart();
}

// Get theme-aware colors
function getThemeColors() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    
    return {
        primary: isDark ? '#bb86fc' : '#667eea',
        secondary: isDark ? '#03dac6' : '#48bb78',
        accent: isDark ? '#2d2d2d' : '#ed8936',
        error: isDark ? '#cf6679' : '#f56565',
        text: isDark ? '#ffffff' : '#2d3748',
        textSecondary: isDark ? '#e0e0e0' : '#718096',
        gridColor: isDark ? '#2d2d2d' : '#e2e8f0',
        background: isDark ? 'rgba(30, 30, 30, 0.8)' : 'rgba(255, 255, 255, 0.8)',
        gradientStart: isDark ? 'rgba(187, 134, 252, 0.3)' : 'rgba(102, 126, 234, 0.3)',
        gradientEnd: isDark ? 'rgba(187, 134, 252, 0.05)' : 'rgba(102, 126, 234, 0.05)',
        borderColor: isDark ? '#ffffff' : '#2d3748',
        chartColors: isDark ? [
            '#bb86fc', '#03dac6', '#f2cc81', '#cf6679', '#8b5cf6', 
            '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#2d2d2d'
        ] : [
            '#667eea', '#48bb78', '#ed8936', '#f56565', '#9f7aea',
            '#38b2ac', '#ecc94b', '#d69e2e', '#319795', '#553c9a'
        ]
    };
}

function initializeDailyEngagementChart() {
    console.log('📈 Initializing daily engagement chart...');
    const { dailyEngagement } = dashboardData;
    const colors = getThemeColors();
    
    const ctx = document.getElementById('dailyEngagementChart').getContext('2d');
    
    if (charts.dailyEngagement) {
        charts.dailyEngagement.destroy();
    }
    
    // Check if we have data
    if (!dailyEngagement || !dailyEngagement.daily_engagement || dailyEngagement.daily_engagement.length === 0) {
        console.warn('⚠️  No daily engagement data available');
        showNoDataChart('dailyEngagementChart', 'No engagement data for last 30 days');
        return;
    }
    
    const labels = dailyEngagement.daily_engagement.map(item => {
        const date = new Date(item.date);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });
    
    const data = dailyEngagement.daily_engagement.map(item => item.queries);
    
    charts.dailyEngagement = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Daily Queries',
                data: data,
                borderColor: colors.primary,
                backgroundColor: colors.gradientStart,
                borderWidth: 4,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: colors.primary,
                pointBorderColor: colors.background,
                pointBorderWidth: 3,
                pointRadius: 6,
                pointHoverRadius: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: colors.background,
                    titleColor: colors.text,
                    bodyColor: colors.text,
                    borderColor: colors.primary,
                    borderWidth: 2,
                    cornerRadius: 12
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: colors.gridColor
                    },
                    ticks: {
                        color: colors.textSecondary
                    }
                },
                x: {
                    grid: {
                        color: colors.gridColor
                    },
                    ticks: {
                        color: colors.textSecondary
                    }
                }
            }
        }
    });
    
    // Update chart stats
    document.getElementById('total-queries-30').textContent = dailyEngagement.total_queries_30_days || 0;
    document.getElementById('avg-daily-queries').textContent = dailyEngagement.average_daily_queries || 0;
}

function initializePeakHoursChart() {
    console.log('🕰️ Initializing peak hours chart...');
    const { peakHours } = dashboardData;
    const colors = getThemeColors();
    
    const ctx = document.getElementById('peakHoursChart').getContext('2d');
    
    if (charts.peakHours) {
        charts.peakHours.destroy();
    }
    
    // Check if we have data
    if (!peakHours || !peakHours.hourly_usage || peakHours.hourly_usage.length === 0) {
        console.warn('⚠️  No peak hours data available');
        showNoDataChart('peakHoursChart', 'No hourly usage data available');
        return;
    }
    
    const labels = peakHours.hourly_usage.map(item => item.hour);
    const data = peakHours.hourly_usage.map(item => item.usage_count);
    
    charts.peakHours = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Queries per Hour',
                data: data,
                backgroundColor: colors.primary,
                borderColor: colors.borderColor,
                borderWidth: 2,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: colors.gridColor
                    },
                    ticks: {
                        color: colors.textSecondary,
                        stepSize: 1
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: colors.textSecondary
                    }
                }
            }
        }
    });
    
    // Update peak hour stats
    document.getElementById('peak-hour').textContent = peakHours.peak_hour || '00:00';
    document.getElementById('peak-hour-count').textContent = peakHours.peak_hour_count || 0;
}

function initializeDemographicsChart() {
    console.log('🎯 Initializing demographics chart...');
    const { demographics } = dashboardData;
    
    // Check if we have valid demographics data
    if (!demographics || demographics.total_users === 0) {
        console.warn('⚠️  No demographics data available');
        showNoDataChart('demographicsChart', 'No user data available');
        return;
    }
    
    // Initialize with age distribution by default
    updateDemographicsChart('age');
}

function initializeContentCategoriesChart() {
    console.log('🏷️ Initializing content categories chart...');
    const { contentCategories } = dashboardData;
    const colors = getThemeColors();
    
    const ctx = document.getElementById('contentCategoriesChart').getContext('2d');
    
    if (charts.contentCategories) {
        charts.contentCategories.destroy();
    }
    
    // Check if we have data
    if (!contentCategories || !contentCategories.category_breakdown || contentCategories.category_breakdown.length === 0) {
        console.warn('⚠️  No content categories data available');
        showNoDataChart('contentCategoriesChart', 'No medical content data to categorize');
        return;
    }
    
    const labels = contentCategories.category_breakdown.map(item => item.category);
    const data = contentCategories.category_breakdown.map(item => item.count);
    
    charts.contentCategories = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Query Count',
                data: data,
                backgroundColor: colors.chartColors.slice(0, labels.length),
                borderColor: colors.borderColor,
                borderWidth: 2,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    grid: {
                        color: colors.gridColor
                    },
                    ticks: {
                        color: colors.textSecondary
                    }
                },
                y: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: colors.textSecondary
                    }
                }
            }
        }
    });
}

function initializeAgeCategoryQueriesChart() {
    console.log('👥 Initializing age category queries chart...');
    const { ageCategoryQueries } = dashboardData;
    const colors = getThemeColors();
    
    const ctx = document.getElementById('ageCategoryQueriesChart').getContext('2d');
    
    if (charts.ageCategoryQueries) {
        charts.ageCategoryQueries.destroy();
    }
    
    // Check if we have data
    if (!ageCategoryQueries || !ageCategoryQueries.age_breakdown || ageCategoryQueries.age_breakdown.length === 0) {
        console.warn('⚠️  No age category queries data available');
        showNoDataChart('ageCategoryQueriesChart', 'No age category data available');
        return;
    }
    
    const labels = ageCategoryQueries.age_breakdown.map(item => item.age_group);
    const data = ageCategoryQueries.age_breakdown.map(item => item.query_count);
    const percentages = ageCategoryQueries.age_breakdown.map(item => item.percentage || 0);
    
    charts.ageCategoryQueries = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Query Count',
                data: data,
                backgroundColor: colors.primary,
                borderColor: colors.borderColor,
                borderWidth: 2,
                borderRadius: 8
            }, {
                label: 'Percentage Distribution',
                data: percentages,
                type: 'line',
                yAxisID: 'y1',
                borderColor: colors.secondary,
                backgroundColor: colors.gradientStart,
                borderWidth: 3,
                fill: false,
                tension: 0.4,
                pointBackgroundColor: colors.secondary,
                pointBorderColor: colors.background,
                pointBorderWidth: 2,
                pointRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: colors.textSecondary
                    }
                }
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    beginAtZero: true,
                    grid: {
                        color: colors.gridColor
                    },
                    ticks: {
                        color: colors.textSecondary
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    beginAtZero: true,
                    grid: {
                        drawOnChartArea: false
                    },
                    ticks: {
                        color: colors.secondary,
                        callback: function(value) {
                            return value + '%';
                        }
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: colors.textSecondary,
                        maxRotation: 45
                    }
                }
            }
        }
    });
    
    // Update chart stats
    document.getElementById('most-active-age-group').textContent = 
        ageCategoryQueries.most_active_age_group?.age_group || 'Unknown';
    document.getElementById('queries-with-age-data').textContent = 
        ageCategoryQueries.queries_with_age_data || 0;
}

// Update tables with data
function updateTables() {
    updateWeeklyUsersTable();
    updateUserQueriesTable();
    updateMedicineSearchTable();
    updateLastUpdatedTime();
}

// Update Weekly Users Table
function updateWeeklyUsersTable() {
    const { weeklyUsers } = dashboardData;
    const tbody = document.getElementById('weeklyUsersTableBody');
    
    if (!weeklyUsers.users || weeklyUsers.users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="loading">No weekly active users found</td></tr>';
        return;
    }
    
    tbody.innerHTML = weeklyUsers.users.map((user, index) => {
        const lastLogin = user.last_login || 'Never';
        const status = user.last_login ? 'Active' : 'Inactive';
        const statusClass = user.last_login ? 'status-active' : 'status-inactive';
        
        return `
            <tr data-user-index="${index}">
                <td title="${user.user_id || 'N/A'}">${user.user_id || 'N/A'}</td>
                <td title="${user.display_name || 'Anonymous'}">${user.display_name || 'Anonymous'}</td>
                <td title="${lastLogin}">${lastLogin}</td>
                <td><span class="${statusClass}" title="${status}">${status}</span></td>
            </tr>
        `;
    }).join('');
}

// Update User Queries Table
function updateUserQueriesTable() {
    const { userQueries } = dashboardData;
    const tbody = document.getElementById('userQueriesTableBody');
    
    if (!userQueries.user_statistics || userQueries.user_statistics.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="loading">No user query data found</td></tr>';
        return;
    }
    
    tbody.innerHTML = userQueries.user_statistics.map((user, index) => {
        const queryCount = user.query_count || 0;
        let activityLevel = 'Low';
        let activityClass = 'activity-low';
        
        if (queryCount > 20) {
            activityLevel = 'High';
            activityClass = 'activity-high';
        } else if (queryCount > 5) {
            activityLevel = 'Medium';
            activityClass = 'activity-medium';
        }
        
        return `
            <tr data-user-index="${index}">
                <td title="${user.user_id || 'N/A'}">${user.user_id || 'N/A'}</td>
                <td title="${user.display_name || 'Anonymous'}">${user.display_name || 'Anonymous'}</td>
                <td title="${queryCount} queries">${queryCount}</td>
                <td title="${user.last_login || 'Never'}">${user.last_login || 'Never'}</td>
                <td><span class="${activityClass}" title="${activityLevel} activity (${queryCount} queries)">${activityLevel}</span></td>
            </tr>
        `;
    }).join('');
}

// Update Medicine Search Table
function updateMedicineSearchTable() {
    const { medicineSearch } = dashboardData;
    const tbody = document.getElementById('medicineSearchTableBody');
    
    if (!medicineSearch.medicine_statistics || medicineSearch.medicine_statistics.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="loading">No medicine search data found</td></tr>';
        return;
    }
    
    tbody.innerHTML = medicineSearch.medicine_statistics.map((medicine, index) => {
        const searchCount = medicine.search_count || 0;
        const userCount = medicine.users ? medicine.users.length : 0;
        
        return `
            <tr data-medicine-index="${index}">
                <td title="${medicine.medicine || 'Unknown'}">${medicine.medicine || 'Unknown'}</td>
                <td title="${searchCount} searches">${searchCount}</td>
                <td title="${userCount} unique users">${userCount}</td>
                <td>
                    <button class="btn btn-sm" onclick="showMedicineDetails('${medicine.medicine}')" title="View users who searched for ${medicine.medicine}">
                        <i class="fas fa-eye"></i> View Users
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// Update metrics
function updateMetrics() {
    updateSessionMetrics();
    updateRetentionMetrics();
    updateLastUpdatedTime();
}

// Update Session Metrics
function updateSessionMetrics() {
    const { chatSessions } = dashboardData;
    
    document.getElementById('total-sessions').textContent = chatSessions.total_sessions || 0;
    document.getElementById('active-sessions').textContent = chatSessions.active_sessions || 0;
    document.getElementById('avg-session-length').textContent = `${chatSessions.average_session_length || 0} msgs`;
    document.getElementById('session-engagement-rate').textContent = `${chatSessions.session_engagement_rate || 0}%`;
}

// Update Retention Metrics
function updateRetentionMetrics() {
    const { retention } = dashboardData;
    
    document.getElementById('new-users-7d').textContent = retention.new_users_last_7_days || 0;
    document.getElementById('new-users-30d').textContent = retention.new_users_last_30_days || 0;
    document.getElementById('returning-users-7d').textContent = retention.returning_users_last_7_days || 0;
    document.getElementById('returning-users-30d').textContent = retention.returning_users_last_30_days || 0;
    document.getElementById('inactive-users').textContent = retention.inactive_users || 0;
}

// Chart refresh functions
function refreshChart(chartType) {
    console.log(`🔄 Refreshing ${chartType} chart...`);
    
    const endpoints = {
        'dailyEngagement': 'daily-engagement',
        'peakHours': 'peak-hours',
        'demographics': 'demographics',
        'contentCategories': 'content-categories',
        'ageCategoryQueries': 'age-category-queries'
    };
    
    const dataKeys = {
        'dailyEngagement': 'dailyEngagement',
        'peakHours': 'peakHours',
        'demographics': 'demographics',
        'contentCategories': 'contentCategories',
        'ageCategoryQueries': 'ageCategoryQueries'
    };
    
    const chartFunctions = {
        'dailyEngagement': initializeDailyEngagementChart,
        'peakHours': initializePeakHoursChart,
        'demographics': () => updateDemographicsChart(),
        'contentCategories': initializeContentCategoriesChart,
        'ageCategoryQueries': initializeAgeCategoryQueriesChart
    };
    
    const endpoint = endpoints[chartType];
    const dataKey = dataKeys[chartType];
    const chartFunction = chartFunctions[chartType];
    
    if (!endpoint || !dataKey || !chartFunction) {
        console.error(`Unknown chart type: ${chartType}`);
        return;
    }
    
    // Show loading state
    const chartContainer = document.querySelector(`#${chartType}Chart`)?.closest('.chart-card');
    if (chartContainer) {
        addRefreshingOverlay(chartContainer);
    }
    
    fetch(`/api/${endpoint}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            dashboardData[dataKey] = data;
            chartFunction();
            console.log(`✅ ${chartType} chart refreshed successfully`);
            showNotification(`${chartType} chart updated!`, 'success', 2000);
        })
        .catch(error => {
            console.error(`❌ Failed to refresh ${chartType} chart:`, error);
            showNotification(`Failed to refresh ${chartType} chart`, 'error');
        })
        .finally(() => {
            if (chartContainer) {
                removeRefreshingOverlay(chartContainer);
            }
        });

    updateLastUpdatedTime();
}

// Global dashboard refresh
async function refreshDashboard(isAutoRefresh = false) {
    console.log(`🔄 ${isAutoRefresh ? 'Auto-' : 'Manual '}refresh started`);
    
    const refreshBtn = document.getElementById('global-refresh-btn');
    
    // Update UI to show refreshing state
    if (refreshBtn) {
        refreshBtn.classList.add('refreshing');
        refreshBtn.innerHTML = '<i class="fas fa-sync-alt fa-spin"></i> Refreshing...';
        refreshBtn.disabled = true;
    }
    
    showLoadingOverlay();
    
    try {
        // Refresh all data
        await loadAllData();
        
        // Update charts
        initializeCharts();
        
        // Update header stats
        updateHeaderStats();
        updateLastUpdatedTime();
        
        console.log('✅ Dashboard refresh completed successfully');
        
        // Show success notification
        showNotification('Dashboard refreshed successfully!', 'success');
        
    } catch (error) {
        console.error('❌ Dashboard refresh failed:', error);
        showNotification('Failed to refresh dashboard. Please try again.', 'error');
    } finally {
        // Restore UI state
        if (refreshBtn) {
            refreshBtn.classList.remove('refreshing');
            refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh All';
            refreshBtn.disabled = false;
        }
        
        hideLoadingOverlay();
    }
}

// Individual refresh functions
async function refreshWeeklyUsers() {
    await refreshComponent('weekly-users', 'weeklyUsers', () => {
        updateQuickStats();
        updateWeeklyUsersTable();
    });
}

async function refreshUserQueries() {
    await refreshComponent('user-queries', 'userQueries', () => {
        updateQuickStats();
        updateUserQueriesTable();
        updateHeaderStats();
    });
}

async function refreshMedicineSearch() {
    await refreshComponent('medicine-search', 'medicineSearch', () => {
        updateQuickStats();
        updateMedicineSearchTable();
    });
}

async function refreshResponseTimes() {
    await refreshComponent('response-times', 'responseTimes', updateQuickStats);
}

async function refreshWeeklyUsersTable() {
    await refreshComponent('weekly-users', 'weeklyUsers', updateWeeklyUsersTable);
}

async function refreshUserQueriesTable() {
    await refreshComponent('user-queries', 'userQueries', updateUserQueriesTable);
}

async function refreshMedicineSearchTable() {
    await refreshComponent('medicine-search', 'medicineSearch', updateMedicineSearchTable);
}

async function refreshSessionData() {
    console.log('🔄 Refreshing session data...');
    
    const sessionCard = document.querySelector('.analytics-grid')?.closest('.data-card');
    if (sessionCard) {
        addRefreshingOverlay(sessionCard);
    }
    
    try {
        const [sessions, retention] = await Promise.all([
            fetch('/api/chat-sessions').then(r => r.json()),
            fetch('/api/retention').then(r => r.json())
        ]);
        
        dashboardData.chatSessions = sessions;
        dashboardData.retention = retention;
        updateSessionMetrics();
        updateRetentionMetrics();
        
        showNotification('Session data updated!', 'success', 2000);
    } catch (error) {
        console.error('❌ Failed to refresh session data:', error);
        showNotification('Failed to refresh session data', 'error');
    } finally {
        if (sessionCard) {
            removeRefreshingOverlay(sessionCard);
        }
    }
    
    updateLastUpdatedTime();
}

async function refreshRetentionData() {
    await refreshComponent('retention', 'retention', updateRetentionMetrics);
}

// Generic component refresh function
async function refreshComponent(endpoint, dataKey, updateCallback) {
    console.log(`🔄 Refreshing ${endpoint}...`);
    
    try {
        const response = await fetch(`/api/${endpoint}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        dashboardData[dataKey] = data;
        
        if (updateCallback) {
            updateCallback();
        }
        
        console.log(`✅ ${endpoint} refreshed successfully`);
        showNotification(`${endpoint.replace('-', ' ')} updated!`, 'success', 2000);
        
    } catch (error) {
        console.error(`❌ Failed to refresh ${endpoint}:`, error);
        showNotification(`Failed to refresh ${endpoint}`, 'error');
    }

    updateLastUpdatedTime();
}

// Utility functions
function showLoadingOverlay(message = 'Loading analytics data...') {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        const loadingContent = overlay.querySelector('.loading-content p');
        if (loadingContent) {
            loadingContent.textContent = message;
        }
        overlay.style.display = 'flex';
    }
}

function hideLoadingOverlay() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

// Show notification
function showNotification(message, type = 'info', duration = 4000) {
    // Remove existing notifications of the same type
    const existingNotifications = document.querySelectorAll(`.notification-${type}`);
    existingNotifications.forEach(notification => {
        if (notification.parentElement) {
            notification.remove();
        }
    });
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas ${getNotificationIcon(type)}"></i>
            <span>${escapeHtml(message)}</span>
        </div>
        <button class="notification-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Auto-remove after duration
    setTimeout(() => {
        if (notification.parentElement) {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.remove();
                }
            }, 300);
        }
    }, duration);
}

// Get notification icon based on type
function getNotificationIcon(type) {
    const icons = {
        'success': 'fa-check-circle',
        'error': 'fa-exclamation-circle',
        'warning': 'fa-exclamation-triangle',
        'info': 'fa-info-circle'
    };
    return icons[type] || icons.info;
}

// HTML escape function for security
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

// Show "No Data" chart
function showNoDataChart(chartId, message) {
    const ctx = document.getElementById(chartId).getContext('2d');
    
    const chartKey = chartId.replace('Chart', '');
    if (charts[chartKey]) {
        charts[chartKey].destroy();
    }
    
    charts[chartKey] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: [message],
            datasets: [{
                data: [1],
                backgroundColor: ['#e2e8f0'],
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 20,
                        color: '#718096'
                    }
                }
            }
        }
    });
}

// Demographics chart update function
function updateDemographicsChart(type = null) {
    const selectedType = type || document.getElementById('demographicType').value;
    const ctx = document.getElementById('demographicsChart').getContext('2d');
    const { demographics } = dashboardData;
    
    console.log('🔄 Updating demographics chart to:', selectedType);
    
    if (charts.demographics) {
        charts.demographics.destroy();
    }
    
    // Check if we have demographics data
    if (!demographics || demographics.total_users === 0) {
        console.warn('⚠️  No demographics data for chart');
        showNoDataChart('demographicsChart', 'No user data available');
        return;
    }
    
    createSingleCategoryChart(ctx, demographics, selectedType);
}

// Create single category detailed chart
function createSingleCategoryChart(ctx, demographics, selectedType) {
    console.log('📈 Creating single category chart for:', selectedType);
    
    let categoryData = {};
    let title = '';
    let colorScheme = [];
    
    switch (selectedType) {
        case 'age':
            categoryData = demographics.age_distribution || {};
            title = 'Age Distribution Analysis';
            colorScheme = ['#ff6b6b', '#ffa726', '#ffca28', '#66bb6a', '#42a5f5', '#ab47bc', '#8d6e63'];
            break;
        case 'verification':
            categoryData = demographics.verification_stats || {};
            title = 'Email Verification Status';
            colorScheme = ['#48bb78', '#f56565'];
            break;
        case 'oauth':
            categoryData = demographics.oauth_providers || {};
            title = 'OAuth Provider Distribution';
            colorScheme = ['#667eea', '#764ba2', '#ed8936', '#9f7aea', '#38b2ac'];
            break;
        case 'profile':
            categoryData = demographics.profile_completion || {};
            title = 'Profile Completion Status';
            colorScheme = ['#10b981', '#ef4444'];
            break;
    }
    
    const labels = Object.keys(categoryData);
    const data = Object.values(categoryData);
    
    if (labels.length === 0 || data.length === 0) {
        showNoDataChart('demographicsChart', `No ${title.toLowerCase()} data`);
        return;
    }
    
    const colors = getThemeColors();
    
    charts.demographics = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'User Count',
                data: data,
                backgroundColor: colorScheme.slice(0, labels.length),
                borderColor: colors.borderColor,
                borderWidth: 2,
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: {
                title: {
                    display: true,
                    text: `${title} (Total: ${demographics.total_users} users)`,
                    color: colors.text
                },
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    grid: {
                        color: colors.gridColor
                    },
                    ticks: {
                        color: colors.textSecondary
                    }
                },
                y: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: colors.textSecondary
                    }
                }
            }
        }
    });
}

// Medicine details modal
function showMedicineDetails(medicineName) {
    const { medicineSearch } = dashboardData;
    const medicine = medicineSearch.medicine_statistics.find(m => m.medicine === medicineName);
    
    if (!medicine) {
        showNotification('Medicine not found', 'error');
        return;
    }
    
    document.getElementById('modalMedicineName').textContent = medicine.medicine;
    document.getElementById('modalSearchCount').textContent = medicine.search_count;
    
    const usersList = document.getElementById('medicineUsersList');
    if (medicine.users && medicine.users.length > 0) {
        usersList.innerHTML = medicine.users.map(user => `
            <div class="user-card">
                <h5>${user.user_name || 'Anonymous'}</h5>
                <p>User ID: ${user.user_id}</p>
                <p>Context: ${user.search_context || 'No context available'}</p>
            </div>
        `).join('');
    } else {
        usersList.innerHTML = '<p>No users found for this medicine.</p>';
    }
    
    document.getElementById('medicineModal').style.display = 'block';
}

function closeMedicineModal() {
    document.getElementById('medicineModal').style.display = 'none';
}

// Table utility functions
function filterTable(tableId, searchValue) {
    const table = document.getElementById(tableId);
    const rows = table.getElementsByTagName('tr');
    
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const cells = row.getElementsByTagName('td');
        let found = false;
        
        for (let j = 0; j < cells.length; j++) {
            const cellText = cells[j].textContent || cells[j].innerText;
            if (cellText.toLowerCase().indexOf(searchValue.toLowerCase()) > -1) {
                found = true;
                break;
            }
        }
        
        row.style.display = found ? '' : 'none';
    }
}

function filterMedicineTable(searchValue) {
    filterTable('medicineSearchTable', searchValue);
}

function sortUserQueries(sortBy) {
    const { userQueries } = dashboardData;
    let sortedData = [...userQueries.user_statistics];
    
    switch (sortBy) {
        case 'queries_desc':
            sortedData.sort((a, b) => (b.query_count || 0) - (a.query_count || 0));
            break;
        case 'queries_asc':
            sortedData.sort((a, b) => (a.query_count || 0) - (b.query_count || 0));
            break;
        case 'name_asc':
            sortedData.sort((a, b) => (a.display_name || '').localeCompare(b.display_name || ''));
            break;
        case 'login_desc':
            sortedData.sort((a, b) => new Date(b.last_login || 0) - new Date(a.last_login || 0));
            break;
    }
    
    dashboardData.userQueries.user_statistics = sortedData;
    updateUserQueriesTable();
}

function exportTable(tableId, filename) {
    const table = document.getElementById(tableId);
    let csv = [];
    const rows = table.querySelectorAll('tr');
    
    for (let i = 0; i < rows.length; i++) {
        const row = [];
        const cols = rows[i].querySelectorAll('td, th');
        
        for (let j = 0; j < cols.length - 1; j++) { // Exclude action column
            row.push('"' + (cols[j].textContent || cols[j].innerText).replace(/"/g, '""') + '"');
        }
        
        csv.push(row.join(','));
    }
    
    const csvContent = csv.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    
    showNotification('Table exported successfully!', 'success');
}

function exportChart(chartType) {
    console.log(`📊 Exporting ${chartType} chart data...`);
    
    const chartData = {
        'dailyEngagement': dashboardData.dailyEngagement,
        'peakHours': dashboardData.peakHours,
        'demographics': dashboardData.demographics,
        'contentCategories': dashboardData.contentCategories,
        'ageCategoryQueries': dashboardData.ageCategoryQueries
    };
    
    const data = chartData[chartType];
    if (!data) {
        showNotification('No data available to export', 'warning');
        return;
    }
    
    // Convert to CSV format
    let csvContent = '';
    let filename = `${chartType}_data_${new Date().toISOString().split('T')[0]}.csv`;
    
    switch (chartType) {
        case 'dailyEngagement':
            csvContent = 'Date,Queries\n';
            data.daily_engagement?.forEach(item => {
                csvContent += `${item.date},${item.queries}\n`;
            });
            break;
        case 'peakHours':
            csvContent = 'Hour,Usage Count\n';
            data.hourly_usage?.forEach(item => {
                csvContent += `${item.hour},${item.usage_count}\n`;
            });
            break;
        case 'demographics':
            csvContent = 'Category,Count\n';
            Object.entries(data.age_distribution || {}).forEach(([key, value]) => {
                csvContent += `${key},${value}\n`;
            });
            break;
        case 'contentCategories':
            csvContent = 'Category,Count,Percentage\n';
            data.category_breakdown?.forEach(item => {
                csvContent += `${item.category},${item.count},${item.percentage}%\n`;
            });
            break;
        case 'ageCategoryQueries':
            csvContent = 'Age Group,Query Count,Percentage\n';
            data.age_breakdown?.forEach(item => {
                csvContent += `${item.age_group},${item.query_count},${item.percentage}%\n`;
            });
            break;
    }
    
    // Download CSV
    downloadCSV(csvContent, filename);
    showNotification(`${chartType} data exported successfully!`, 'success');
}

// Download CSV helper function
function downloadCSV(csvContent, filename) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

function exportSessionData() {
    const data = dashboardData.chatSessions;
    if (!data) {
        showNotification('No session data available to export', 'warning');
        return;
    }
    
    const csvContent = `Metric,Value\nTotal Sessions,${data.total_sessions || 0}\nActive Sessions,${data.active_sessions || 0}\nAverage Session Length,${data.average_session_length || 0}\nEngagement Rate,${data.session_engagement_rate || 0}%\n`;
    
    const filename = `session_analysis_${new Date().toISOString().split('T')[0]}.csv`;
    downloadCSV(csvContent, filename);
    showNotification('Session data exported successfully!', 'success');
}

function exportRetentionData() {
    const data = dashboardData.retention;
    if (!data) {
        showNotification('No retention data available to export', 'warning');
        return;
    }
    
    const csvContent = `Metric,Count\nNew Users (7 days),${data.new_users_last_7_days || 0}\nNew Users (30 days),${data.new_users_last_30_days || 0}\nReturning Users (7 days),${data.returning_users_last_7_days || 0}\nReturning Users (30 days),${data.returning_users_last_30_days || 0}\nInactive Users,${data.inactive_users || 0}\n`;
    
    const filename = `retention_analysis_${new Date().toISOString().split('T')[0]}.csv`;
    downloadCSV(csvContent, filename);
    showNotification('Retention data exported successfully!', 'success');
}

// Add refreshing overlay to element
function addRefreshingOverlay(element) {
    if (element.querySelector('.refreshing-overlay')) {
        return; // Already has overlay
    }
    
    const overlay = document.createElement('div');
    overlay.className = 'refreshing-overlay';
    overlay.innerHTML = '<div class="refreshing-spinner"></div>';
    overlay.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(255, 255, 255, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
    `;
    
    element.style.position = 'relative';
    element.appendChild(overlay);
}

// Remove refreshing overlay from element
function removeRefreshingOverlay(element) {
    const overlay = element.querySelector('.refreshing-overlay');
    if (overlay) {
        overlay.remove();
    }
}

// Natural Language Query Functions
let currentQueryResults = null;
let queryCounter = 0;

// Load sample queries for the interface
function loadSampleQueries() {
    const sampleQueries = [
        "Show me the top 10 most active users",
        "How many users registered last month?",
        "What are the most common symptoms mentioned?",
        "Which medicines are searched most frequently?",
        "Show user activity by hour of day",
        "List all users who haven't logged in for 30 days"
    ];
    
    const suggestionsContainer = document.getElementById('querySuggestions');
    if (suggestionsContainer) {
        suggestionsContainer.innerHTML = sampleQueries.map(query => `
            <div class="suggestion-item" onclick="useSampleQuery('${escapeHtml(query)}')">
                ${escapeHtml(query)}
            </div>
        `).join('');
    }
}

// Use a sample query
function useSampleQuery(query) {
    const queryInput = document.getElementById('naturalQueryInput');
    if (queryInput) {
        queryInput.value = query;
        queryInput.focus();
    }
}

// Execute natural language query
async function executeNaturalQuery() {
    const queryInput = document.getElementById('naturalQueryInput');
    const executeBtn = document.getElementById('executeQueryBtn');
    
    if (!queryInput || !executeBtn) {
        showNotification('Query interface not found', 'error');
        return;
    }
    
    const query = queryInput.value.trim();
    if (!query) {
        showNotification('Please enter a query', 'warning');
        return;
    }
    
    // Disable button and show loading
    executeBtn.disabled = true;
    executeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    
    try {
        const response = await fetch('/api/natural-query', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query: query })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        // Display the result
        displayQueryResult(query, result);
        
        // Clear the input
        queryInput.value = '';
        
        showNotification('Query executed successfully!', 'success');
        
    } catch (error) {
        console.error('Natural query error:', error);
        showNotification(`Query failed: ${error.message}`, 'error');
        
        // Display error result
        displayQueryResult(query, {
            success: false,
            error: error.message,
            data: null
        });
        
    } finally {
        // Restore button
        executeBtn.disabled = false;
        executeBtn.innerHTML = '<i class="fas fa-play"></i> Execute Query';
    }
}

// Display query result
function displayQueryResult(query, result) {
    queryCounter++;
    
    const queryInterface = document.querySelector('.query-interface');
    
    // Create result container
    const resultContainer = document.createElement('div');
    resultContainer.className = 'query-result-pair';
    resultContainer.innerHTML = `
        <div class="query-item">
            <div class="query-header">
                <h4>Query #${queryCounter}</h4>
                <button class="btn-icon copy-query-btn" onclick="copyToClipboard('${escapeHtml(query)}')" title="Copy Query">
                    <i class="fas fa-copy"></i>
                </button>
            </div>
            <div class="query-text">${escapeHtml(query)}</div>
        </div>
        
        <div class="result-item ${result.success ? 'success' : 'error'}">
            <div class="result-header">
                <h4>Result</h4>
                <div class="result-actions">
                    ${result.success ? `<button class="btn-icon" onclick="exportQueryResult(${queryCounter})" title="Export"><i class="fas fa-download"></i></button>` : ''}
                    <button class="btn-icon" onclick="this.closest('.query-result-pair').remove()" title="Remove"><i class="fas fa-times"></i></button>
                </div>
            </div>
            <div class="result-content">
                ${formatQueryResult(result)}
            </div>
        </div>
    `;
    
    // Add to interface
    queryInterface.appendChild(resultContainer);
    
    // Scroll to new result
    resultContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    
    // Store result for export
    currentQueryResults = currentQueryResults || {};
    currentQueryResults[queryCounter] = { query, result };
}

// Format query result for display
function formatQueryResult(result) {
    if (!result.success) {
        return `
            <div class="error-message">
                <i class="fas fa-exclamation-triangle"></i>
                <strong>Error:</strong> ${escapeHtml(result.error || 'Unknown error occurred')}
                ${result.details ? `<br><small>${escapeHtml(result.details)}</small>` : ''}
            </div>
        `;
    }
    
    if (!result.data) {
        return '<div class="no-data">No data returned</div>';
    }
    
    // Handle different data types
    if (Array.isArray(result.data)) {
        if (result.data.length === 0) {
            return '<div class="no-data">No results found</div>';
        }
        
        // Create table for array data
        const headers = Object.keys(result.data[0]);
        return `
            <div class="result-table-container">
                <table class="result-table">
                    <thead>
                        <tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr>
                    </thead>
                    <tbody>
                        ${result.data.slice(0, 100).map(row => 
                            `<tr>${headers.map(h => `<td>${escapeHtml(String(row[h] || ''))}</td>`).join('')}</tr>`
                        ).join('')}
                    </tbody>
                </table>
                ${result.data.length > 100 ? `<div class="result-note">Showing first 100 of ${result.data.length} results</div>` : ''}
            </div>
        `;
    } else if (typeof result.data === 'object') {
        // Handle object data
        return `
            <div class="result-object">
                <pre>${JSON.stringify(result.data, null, 2)}</pre>
            </div>
        `;
    } else {
        // Handle primitive data
        return `<div class="result-value">${escapeHtml(String(result.data))}</div>`;
    }
}

// Export query result
function exportQueryResult(queryId) {
    if (!currentQueryResults || !currentQueryResults[queryId]) {
        showNotification('Query result not found', 'error');
        return;
    }
    
    const { query, result } = currentQueryResults[queryId];
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `query_result_${queryId}_${timestamp}.json`;
    
    const exportData = {
        query: query,
        result: result,
        exported_at: new Date().toISOString(),
        query_id: queryId
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    
    showNotification('Query result exported!', 'success');
}

// Clear all query results
function clearAllQueryResults() {
    const queryInterface = document.querySelector('.query-interface');
    const resultPairs = queryInterface.querySelectorAll('.query-result-pair');
    
    resultPairs.forEach(pair => {
        pair.style.opacity = '0';
        pair.style.transform = 'translateY(-20px)';
        setTimeout(() => pair.remove(), 300);
    });
    
    queryCounter = 0;
    currentQueryResults = null;
    
    showNotification('All query results cleared', 'info', 2000);
}

// Database structure modal functions
function showDatabaseStructure() {
    const modal = document.getElementById('dbStructureModal');
    if (modal) {
        modal.style.display = 'block';
        
        // Load database structure
        fetch('/api/db-structure')
            .then(response => response.json())
            .then(data => {
                const structureContent = document.getElementById('dbStructureContent');
                structureContent.innerHTML = `
                    <div class="db-structure">
                        <h4>Database Collections</h4>
                        ${Object.entries(data.collections || {}).map(([collection, info]) => `
                            <div class="collection-info">
                                <h5><i class="fas fa-table"></i> ${collection}</h5>
                                <div class="fields-list">
                                    <strong>Fields:</strong>
                                    <ul>
                                        ${info.fields.map(field => `<li>${field}</li>`).join('')}
                                    </ul>
                                </div>
                                ${info.subcollections.length > 0 ? `
                                    <div class="subcollections">
                                        <strong>Subcollections:</strong> ${info.subcollections.join(', ')}
                                    </div>
                                ` : ''}
                            </div>
                        `).join('')}
                    </div>
                `;
            })
            .catch(error => {
                console.error('Failed to load database structure:', error);
                const structureContent = document.getElementById('dbStructureContent');
                structureContent.innerHTML = '<div class="error">Failed to load database structure</div>';
            });
    }
}

function closeDbStructureModal() {
    const modal = document.getElementById('dbStructureModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function showSampleQueriesModal() {
    const modal = document.getElementById('sampleQueriesModal');
    if (modal) {
        modal.style.display = 'block';
        
        const samplesList = document.getElementById('sampleQueriesList');
        const queries = [
            "Show me users who registered in the last 7 days",
            "What is the average session length for active users?",
            "List the top 5 most searched medicines",
            "How many queries were made during peak hours?",
            "Show user retention rate for the last month",
            "Which age group is most active?",
            "What are the common symptoms mentioned in queries?",
            "Show daily user engagement trends"
        ];
        
        samplesList.innerHTML = queries.map(query => `
            <div class="sample-query-item" onclick="useSampleQuery('${escapeHtml(query)}'); closeSampleQueriesModal();">
                ${escapeHtml(query)}
            </div>
        `).join('');
    }
}

function closeSampleQueriesModal() {
    const modal = document.getElementById('sampleQueriesModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Enhanced export functionality
function exportDashboard() {
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `medglance_dashboard_${timestamp}.json`;
    
    const dashboardDataExport = {
        exported_at: new Date().toISOString(),
        dashboard_version: '2.0',
        kpis: {
            weekly_active_users: document.getElementById('weekly-active-users')?.textContent || 0,
            avg_queries_per_user: document.getElementById('avg-queries-per-user')?.textContent || 0,
            medicine_searches: document.getElementById('medicine-searches')?.textContent || 0,
            avg_response_time: document.getElementById('avg-response-time')?.textContent || 0
        },
        session_metrics: {
            total_sessions: document.getElementById('total-sessions')?.textContent || 0,
            active_sessions: document.getElementById('active-sessions')?.textContent || 0,
            avg_session_length: document.getElementById('avg-session-length')?.textContent || 0,
            engagement_rate: document.getElementById('session-engagement-rate')?.textContent || 0
        },
        retention_metrics: {
            new_users_7d: document.getElementById('new-users-7d')?.textContent || 0,
            new_users_30d: document.getElementById('new-users-30d')?.textContent || 0,
            returning_users_7d: document.getElementById('returning-users-7d')?.textContent || 0,
            returning_users_30d: document.getElementById('returning-users-30d')?.textContent || 0,
            inactive_users: document.getElementById('inactive-users')?.textContent || 0
        },
        raw_data: dashboardData
    };
    
    const blob = new Blob([JSON.stringify(dashboardDataExport, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    
    showNotification('Dashboard data exported successfully!', 'success');
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
};

// Enhanced responsive chart handling
function handleChartResize() {
    Object.values(charts).forEach(chart => {
        if (chart && typeof chart.resize === 'function') {
            chart.resize();
        }
    });
}

// Debounced resize handler
let resizeTimeout;
window.addEventListener('resize', function() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(handleChartResize, 250);
});

// Initialize everything when page loads
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Medical Dashboard v2.0 Initialized');
});
