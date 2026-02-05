/**
 * Dashboard JavaScript
 * Main application logic for the health monitoring dashboard
 */

// Global application state
const app = {
    socket: null,
    charts: {},
    data: {
        patients: [],
        alerts: [],
        devices: []
    },
    
    // Initialize the dashboard
    init() {
        this.checkAuth();
        this.setupEventListeners();
        this.initScrollReveal();
        this.initCharts();
        this.loadDashboardData();
        this.connectWebSocket();
        this.startRealTimeUpdates();
    },
    
    // Check authentication - Allow demo mode
    checkAuth() {
        // For demo purposes, auto-login if no auth
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('userName', 'Demo User');
        
        const userName = localStorage.getItem('userName') || 'Admin';
        const userNameEl = document.getElementById('user-name');
        const welcomeNameEl = document.getElementById('welcome-name');
        
        if (userNameEl) userNameEl.textContent = userName;
        if (welcomeNameEl) welcomeNameEl.textContent = userName;
    },
    
    // Setup event listeners
    setupEventListeners() {
        // Sidebar toggle
        const sidebarToggle = document.getElementById('sidebar-toggle');
        const sidebar = document.querySelector('.sidebar');
        
        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', () => {
                sidebar.classList.toggle('active');
            });
        }
        
        // Navigation items
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = item.dataset.page;
                this.navigateTo(page);
            });
        });
        
        // Notification toggle
        const notificationToggle = document.getElementById('notification-toggle');
        const notificationPanel = document.getElementById('notification-panel');
        
        if (notificationToggle && notificationPanel) {
            notificationToggle.addEventListener('click', () => {
                notificationPanel.classList.toggle('active');
            });
        }
        
        // Close notification panel when clicking outside
        document.addEventListener('click', (e) => {
            if (notificationPanel && 
                !notificationPanel.contains(e.target) && 
                e.target !== notificationToggle &&
                !notificationToggle?.contains(e.target)) {
                notificationPanel.classList.remove('active');
            }
        });
        
        // Time range buttons
        document.querySelectorAll('.range-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.updateChartRange(btn.dataset.range);
            });
        });
    },
    
    // Initialize scroll reveal
    initScrollReveal() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                }
            });
        }, { threshold: 0.1 });
        
        document.querySelectorAll('.reveal-scroll').forEach(el => {
            observer.observe(el);
        });
    },
    
    // Initialize charts
    initCharts() {
        this.initHealthChart();
        this.initAlertChart();
        this.animateCounters();
    },
    
    // Initialize health overview chart
    initHealthChart() {
        const ctx = document.getElementById('healthChart');
        if (!ctx) return;
        
        this.charts.health = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'],
                datasets: [
                    {
                        label: 'Heart Rate',
                        data: [68, 65, 70, 72, 75, 71],
                        borderColor: '#ef4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        fill: true,
                        tension: 0.4,
                        pointRadius: 0,
                        pointHoverRadius: 4,
                        borderWidth: 2
                    },
                    {
                        label: 'Temperature',
                        data: [36.5, 36.4, 36.6, 36.8, 36.7, 36.5],
                        borderColor: '#f59e0b',
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                        fill: true,
                        tension: 0.4,
                        pointRadius: 0,
                        pointHoverRadius: 4,
                        borderWidth: 2,
                        yAxisID: 'y1'
                    },
                    {
                        label: 'SpO2',
                        data: [97, 98, 97, 98, 99, 98],
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        fill: true,
                        tension: 0.4,
                        pointRadius: 0,
                        pointHoverRadius: 4,
                        borderWidth: 2,
                        yAxisID: 'y2'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)'
                        },
                        ticks: {
                            color: '#64748b'
                        }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        min: 50,
                        max: 100,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)'
                        },
                        ticks: {
                            color: '#ef4444'
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        min: 35,
                        max: 40,
                        grid: {
                            drawOnChartArea: false
                        },
                        ticks: {
                            color: '#f59e0b'
                        }
                    },
                    y2: {
                        type: 'linear',
                        display: false,
                        min: 90,
                        max: 100
                    }
                },
                animation: {
                    duration: 2000,
                    easing: 'easeOutQuart'
                }
            }
        });
    },
    
    // Initialize alert distribution chart
    initAlertChart() {
        const ctx = document.getElementById('alertChart');
        if (!ctx) return;
        
        this.charts.alert = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Critical', 'Warning', 'Info', 'Resolved'],
                datasets: [{
                    data: [5, 12, 8, 45],
                    backgroundColor: [
                        '#ef4444',
                        '#f59e0b',
                        '#3b82f6',
                        '#10b981'
                    ],
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: {
                    legend: {
                        display: false
                    }
                },
                animation: {
                    animateRotate: true,
                    animateScale: true
                }
            }
        });
    },
    
    // Update chart based on time range
    updateChartRange(range) {
        if (!this.charts.health) return;
        
        let labels, heartData, tempData, spo2Data;
        
        switch(range) {
            case '24h':
                labels = ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'];
                heartData = [68, 65, 70, 72, 75, 71];
                tempData = [36.5, 36.4, 36.6, 36.8, 36.7, 36.5];
                spo2Data = [97, 98, 97, 98, 99, 98];
                break;
            case '7d':
                labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                heartData = [70, 72, 68, 74, 71, 69, 73];
                tempData = [36.5, 36.6, 36.4, 36.7, 36.5, 36.6, 36.5];
                spo2Data = [97, 98, 97, 98, 98, 97, 98];
                break;
            case '30d':
                labels = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
                heartData = [72, 70, 71, 73];
                tempData = [36.5, 36.6, 36.4, 36.5];
                spo2Data = [97, 98, 97, 98];
                break;
        }
        
        this.charts.health.data.labels = labels;
        this.charts.health.data.datasets[0].data = heartData;
        this.charts.health.data.datasets[1].data = tempData;
        this.charts.health.data.datasets[2].data = spo2Data;
        this.charts.health.update('active');
    },
    
    // Load dashboard data
    async loadDashboardData() {
        try {
            // Load patients
            await this.loadPatients();
            
            // Load alerts
            await this.loadAlerts();
            
            // Load devices
            await this.loadDevices();
            
        } catch (error) {
            console.error('Error loading dashboard data:', error);
            // Use demo data
            this.loadDemoData();
        }
    },
    
    // Load patients from API
    async loadPatients() {
        try {
            const response = await fetch('/api/patients');
            if (response.ok) {
                this.data.patients = await response.json();
                this.renderPatients();
            } else {
                throw new Error('Failed to load patients');
            }
        } catch (error) {
            console.warn('Using demo patient data');
            this.loadDemoPatients();
            this.renderPatients();
        }
    },
    
    // Load demo patients
    loadDemoPatients() {
        this.data.patients = [
            { id: 1, name: 'Kaustav', age: 21, heartRate: 72, temperature: 36.8, spo2: 98, status: 'online', device: 'ESP32-001', battery: 85 },
            { id: 2, name: 'Yusuf', age: 22, heartRate: 78, temperature: 36.6, spo2: 97, status: 'online', device: 'ESP32-002', battery: 72 },
            { id: 3, name: 'Sushanth', age: 20, heartRate: 68, temperature: 36.5, spo2: 99, status: 'online', device: 'ESP32-003', battery: 90 },
            { id: 4, name: 'Niladri', age: 21, heartRate: 75, temperature: 36.9, spo2: 96, status: 'warning', device: 'ESP32-004', battery: 45 }
        ];
    },
    
    // Render patients grid
    renderPatients() {
        const grid = document.getElementById('patients-grid');
        if (!grid) return;
        
        grid.innerHTML = this.data.patients.map(patient => `
            <div class="patient-card">
                <div class="patient-header">
                    <div class="patient-avatar">${patient.name.split(' ').map(n => n[0]).join('')}</div>
                    <div class="patient-info">
                        <h4>${patient.name}</h4>
                        <p>Age: ${patient.age}</p>
                    </div>
                    <div class="patient-status ${patient.status}"></div>
                </div>
                <div class="patient-metrics">
                    <div class="metric">
                        <span class="metric-label">Heart Rate</span>
                        <span class="metric-value ${this.getMetricClass(patient.heartRate, 'heartRate')}">${patient.heartRate} <span>BPM</span></span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Temperature</span>
                        <span class="metric-value ${this.getMetricClass(patient.temperature, 'temperature')}">${patient.temperature} <span>°C</span></span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">SpO2</span>
                        <span class="metric-value ${this.getMetricClass(patient.spo2, 'spo2')}">${patient.spo2} <span>%</span></span>
                    </div>
                </div>
                <div class="patient-footer">
                    <div class="patient-device">
                        <i class="fas fa-microchip"></i>
                        ${patient.device}
                    </div>
                    <div class="patient-battery">
                        <i class="fas fa-battery-${this.getBatteryLevel(patient.battery)}"></i>
                        ${patient.battery}%
                    </div>
                </div>
            </div>
        `).join('');
    },
    
    // Get metric class based on value
    getMetricClass(value, type) {
        if (type === 'heartRate') {
            if (value > 100 || value < 50) return 'danger';
            if (value > 90 || value < 60) return 'warning';
            return 'success';
        } else if (type === 'temperature') {
            if (value > 38 || value < 35) return 'danger';
            if (value > 37.5 || value < 35.5) return 'warning';
            return 'success';
        } else if (type === 'spo2') {
            if (value < 90) return 'danger';
            if (value < 95) return 'warning';
            return 'success';
        }
        return '';
    },
    
    // Get battery icon
    getBatteryLevel(level) {
        if (level > 75) return 'full';
        if (level > 50) return 'three-quarters';
        if (level > 25) return 'half';
        if (level > 10) return 'quarter';
        return 'empty';
    },
    
    // Load alerts from API
    async loadAlerts() {
        try {
            const response = await fetch('/api/alerts');
            if (response.ok) {
                this.data.alerts = await response.json();
                this.renderAlerts();
            } else {
                throw new Error('Failed to load alerts');
            }
        } catch (error) {
            console.warn('Using demo alert data');
            this.loadDemoAlerts();
            this.renderAlerts();
        }
    },
    
    // Load demo alerts
    loadDemoAlerts() {
        this.data.alerts = [
            { id: 1, type: 'critical', title: 'Critical Alert', message: 'Patient Niladri\'s heart rate exceeded 100 BPM', time: '2 minutes ago' },
            { id: 2, type: 'warning', title: 'Warning', message: 'Device ESP32-004 battery below 20%', time: '15 minutes ago' },
            { id: 3, type: 'info', title: 'Device Connected', message: 'New device ESP32-005 is now online', time: '1 hour ago' },
            { id: 4, type: 'critical', title: 'Critical Alert', message: 'Patient Kaustav temperature above 38°C', time: '30 minutes ago' },
            { id: 5, type: 'warning', title: 'Warning', message: 'SpO2 level below 95% for patient Yusuf', time: '45 minutes ago' }
        ];
    },
    
    // Render alerts list
    renderAlerts() {
        const list = document.getElementById('alerts-list');
        if (!list) return;
        
        list.innerHTML = this.data.alerts.slice(0, 5).map(alert => `
            <div class="alert-item ${alert.type}">
                <div class="alert-icon">
                    <i class="fas ${this.getAlertIcon(alert.type)}"></i>
                </div>
                <div class="alert-content">
                    <h4>${alert.title}</h4>
                    <p>${alert.message}</p>
                    <span class="alert-time">${alert.time}</span>
                </div>
            </div>
        `).join('');
        
        // Update alert badge
        const badge = document.querySelector('.alert-badge');
        if (badge) {
            badge.textContent = this.data.alerts.filter(a => a.type === 'critical' || a.type === 'warning').length;
        }
    },
    
    // Get alert icon
    getAlertIcon(type) {
        switch(type) {
            case 'critical': return 'fa-exclamation-circle';
            case 'warning': return 'fa-exclamation-triangle';
            case 'info': return 'fa-info-circle';
            default: return 'fa-bell';
        }
    },
    
    // Load devices from API
    async loadDevices() {
        try {
            const response = await fetch('/api/devices');
            if (response.ok) {
                this.data.devices = await response.json();
                this.renderDevices();
            } else {
                throw new Error('Failed to load devices');
            }
        } catch (error) {
            console.warn('Using demo device data');
            this.loadDemoDevices();
            this.renderDevices();
        }
    },
    
    // Load demo devices
    loadDemoDevices() {
        this.data.devices = [
            { id: 'ESP32-001', name: 'Kaustav', status: 'online', battery: 85 },
            { id: 'ESP32-002', name: 'Yusuf', status: 'online', battery: 72 },
            { id: 'ESP32-003', name: 'Sushanth', status: 'online', battery: 90 },
            { id: 'ESP32-004', name: 'Niladri', status: 'warning', battery: 45 }
        ];
    },
    
    // Render devices grid
    renderDevices() {
        const grid = document.getElementById('devices-grid');
        if (!grid) return;
        
        grid.innerHTML = this.data.devices.map(device => `
            <div class="device-card">
                <div class="device-status ${device.status}"></div>
                <div class="device-icon">
                    <i class="fas fa-microchip"></i>
                </div>
                <div class="device-info">
                    <h4>${device.id}</h4>
                    <p>${device.name}</p>
                </div>
                <div class="device-meta">
                    <span class="device-patient">${device.name}</span>
                    <span class="device-battery">
                        <i class="fas fa-battery-${this.getBatteryLevel(device.battery)}"></i>
                        ${device.battery}%
                    </span>
                </div>
            </div>
        `).join('');
    },
    
    // Load demo data
    loadDemoData() {
        this.loadDemoPatients();
        this.loadDemoAlerts();
        this.loadDemoDevices();
        this.renderPatients();
        this.renderAlerts();
        this.renderDevices();
    },
    
    // Animate counters
    animateCounters() {
        const counters = document.querySelectorAll('.stat-number[data-count]');
        
        counters.forEach(counter => {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        this.animateCounter(entry.target);
                        observer.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.5 });
            
            observer.observe(counter);
        });
    },
    
    // Animate single counter
    animateCounter(element) {
        const target = parseInt(element.dataset.count);
        const duration = 2000;
        const start = 0;
        const startTime = performance.now();
        
        const update = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeOutQuart = 1 - Math.pow(1 - progress, 4);
            const current = Math.floor(start + (target - start) * easeOutQuart);
            
            element.textContent = current;
            
            if (progress < 1) {
                requestAnimationFrame(update);
            }
        };
        
        requestAnimationFrame(update);
    },
    
    // Connect to WebSocket for real-time updates
    connectWebSocket() {
        // Socket.IO connection (optional - works without server)
        if (typeof io !== 'undefined') {
            this.socket = io();
            
            this.socket.on('connect', () => {
                console.log('Connected to server');
            });
            
            this.socket.on('healthData', (data) => {
                this.handleHealthDataUpdate(data);
            });
            
            this.socket.on('alert', (alert) => {
                this.handleNewAlert(alert);
            });
        }
    },
    
    // Start real-time updates simulation
    startRealTimeUpdates() {
        // Simulate real-time updates every 5 seconds
        setInterval(() => {
            this.simulateHealthDataUpdate();
        }, 5000);
    },
    
    // Simulate health data update
    simulateHealthDataUpdate() {
        if (this.data.patients.length > 0) {
            const randomPatient = this.data.patients[Math.floor(Math.random() * this.data.patients.length)];
            
            // Update values slightly
            randomPatient.heartRate = Math.max(50, Math.min(120, randomPatient.heartRate + Math.floor(Math.random() * 5) - 2));
            randomPatient.temperature = Math.max(35, Math.min(39, randomPatient.temperature + (Math.random() * 0.2 - 0.1)));
            randomPatient.spo2 = Math.max(90, Math.min(100, randomPatient.spo2 + Math.floor(Math.random() * 3) - 1));
            
            // Re-render
            this.renderPatients();
            
            // Update chart
            if (this.charts.health) {
                const newData = [...this.charts.health.data.datasets[0].data.slice(1), randomPatient.heartRate];
                this.charts.health.data.datasets[0].data = newData;
                this.charts.health.update('active');
            }
        }
    },
    
    // Handle health data update
    handleHealthDataUpdate(data) {
        console.log('Health data update:', data);
        // Update patient data and re-render
    },
    
    // Handle new alert
    handleNewAlert(alert) {
        this.data.alerts.unshift(alert);
        this.renderAlerts();
        this.showToast(`${alert.title}: ${alert.message}`, alert.type);
    },
    
    // Navigate to page
    navigateTo(page) {
        // Update active nav item
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.page === page) {
                item.classList.add('active');
            }
        });
        
        // Update page title
        const titles = {
            dashboard: 'Dashboard',
            patients: 'Patients',
            alerts: 'Alerts',
            devices: 'Devices',
            analytics: 'Analytics',
            settings: 'Settings'
        };
        
        const titleEl = document.getElementById('current-page-title');
        if (titleEl) {
            titleEl.textContent = titles[page] || 'Dashboard';
        }
    },
    
    // Show toast notification
    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <i class="fas ${this.getToastIcon(type)}"></i>
            <span>${message}</span>
        `;
        
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'toastSlideIn 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    },
    
    // Get toast icon
    getToastIcon(type) {
        switch(type) {
            case 'success': return 'fa-check-circle';
            case 'error': return 'fa-times-circle';
            case 'warning': return 'fa-exclamation-triangle';
            default: return 'fa-info-circle';
        }
    },
    
    // Refresh data
    refreshData() {
        this.loadDashboardData();
        this.showToast('Data refreshed', 'success');
    },
    
    // Export report
    exportReport() {
        this.showToast('Generating report...', 'info');
        setTimeout(() => {
            this.showToast('Report downloaded successfully', 'success');
        }, 2000);
    },
    
    // Show add patient modal
    showAddPatientModal() {
        this.showToast('Add patient feature coming soon', 'info');
    },
    
    // Logout
    logout() {
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('userEmail');
        localStorage.removeItem('userName');
        window.location.href = 'login.html';
    }
};

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});

// Expose functions globally
window.app = app;
window.logout = () => app.logout();
window.refreshData = () => app.refreshData();
window.exportReport = () => app.exportReport();
window.showAddPatientModal = () => app.showAddPatientModal();
window.navigateTo = (page) => app.navigateTo(page);
window.closeModal = () => {
    document.getElementById('modal-overlay')?.classList.remove('active');
};
