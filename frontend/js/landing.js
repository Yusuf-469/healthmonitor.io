/**
 * Landing Page JavaScript
 * Handles scroll animations, hero chart, and interactivity
 */

// DOM Elements
const heroChartCanvas = document.getElementById('heroChart');
let heroChart = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initScrollReveal();
    initHeroChart();
    initCountAnimations();
    initNavigation();
    initMobileMenu();
});

/**
 * Initialize scroll reveal animations
 */
function initScrollReveal() {
    // Create intersection observer for scroll animations
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Add visible class with slight delay for staggered effect
                setTimeout(() => {
                    entry.target.classList.add('visible');
                }, entry.target.dataset.delay || 0);
            }
        });
    }, observerOptions);

    // Observe all scroll reveal elements
    document.querySelectorAll('.reveal-scroll').forEach(el => {
        observer.observe(el);
    });
}

/**
 * Initialize hero chart
 */
function initHeroChart() {
    if (!heroChartCanvas) return;

    const ctx = heroChartCanvas.getContext('2d');

    heroChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'],
            datasets: [{
                label: 'Heart Rate',
                data: [65, 62, 70, 75, 72, 68],
                borderColor: '#ef4444',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 0,
                pointHoverRadius: 4,
                borderWidth: 2
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
                x: {
                    display: false
                },
                y: {
                    display: false,
                    min: 50,
                    max: 100
                }
            },
            animation: {
                duration: 2000,
                easing: 'easeOutQuart'
            }
        }
    });

    // Animate chart data periodically
    setInterval(() => {
        if (heroChart) {
            const newData = [];
            for (let i = 0; i < 6; i++) {
                newData.push(Math.floor(Math.random() * 20) + 60);
            }
            heroChart.data.datasets[0].data = newData;
            heroChart.update('active');
        }
    }, 3000);
}

/**
 * Initialize count animations for statistics
 */
function initCountAnimations() {
    const countElements = document.querySelectorAll('.stat-number[data-count]');

    const observerOptions = {
        threshold: 0.5
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                animateCount(entry.target);
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    countElements.forEach(el => {
        observer.observe(el);
    });
}

/**
 * Animate number counting
 */
function animateCount(element) {
    const target = parseInt(element.dataset.count);
    const duration = 2000;
    const start = 0;
    const startTime = performance.now();

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        const current = Math.floor(start + (target - start) * easeOutQuart);

        element.textContent = current;

        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }

    requestAnimationFrame(update);
}

/**
 * Initialize smooth scrolling navigation
 */
function initNavigation() {
    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            
            if (targetId === '#') return;
            
            const target = document.querySelector(targetId);
            if (target) {
                const navHeight = document.getElementById('main-nav').offsetHeight;
                const targetPosition = target.offsetTop - navHeight;

                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });

    // Update active nav link on scroll
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-link');

    window.addEventListener('scroll', () => {
        const scrollPosition = window.scrollY + 100;

        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.offsetHeight;
            const sectionId = section.getAttribute('id');

            if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
                navLinks.forEach(link => {
                    link.classList.remove('active');
                    if (link.getAttribute('href') === `#${sectionId}`) {
                        link.classList.add('active');
                    }
                });
            }
        });
    });

    // Navbar scroll effect
    const nav = document.getElementById('main-nav');
    let lastScroll = 0;

    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;

        if (currentScroll > 50) {
            nav.classList.add('scrolled');
        } else {
            nav.classList.remove('scrolled');
        }

        lastScroll = currentScroll;
    });
}

/**
 * Initialize mobile menu toggle
 */
function initMobileMenu() {
    const mobileToggle = document.getElementById('mobile-toggle');
    const navLinks = document.querySelector('.nav-links');

    if (mobileToggle) {
        mobileToggle.addEventListener('click', () => {
            mobileToggle.classList.toggle('active');
            navLinks.classList.toggle('active');
        });
    }
}

/**
 * Handle contact form submission
 */
function handleContact(event) {
    event.preventDefault();

    const form = event.target;
    const formData = new FormData(form);

    // Simulate form submission
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
    submitBtn.disabled = true;

    setTimeout(() => {
        showToast('Message sent successfully! We\'ll get back to you soon.', 'success');
        form.reset();
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }, 1500);
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
    // Create toast element if it doesn't exist
    let toast = document.querySelector('.toast');
    
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerHTML = '<i class="toast-icon"></i><span class="toast-message"></span>';
        document.body.appendChild(toast);
    }

    const icons = {
        success: 'fa-check-circle',
        error: 'fa-times-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };

    toast.querySelector('.toast-icon').className = `toast-icon fas ${icons[type] || icons.info}`;
    toast.querySelector('.toast-message').textContent = message;
    toast.className = `toast ${type} show`;

    setTimeout(() => {
        toast.classList.remove('show');
    }, 4000);
}

/**
 * Animate metric values on hero section
 */
function animateMetrics() {
    const metricValues = document.querySelectorAll('.metric-value .value[data-value]');

    metricValues.forEach(el => {
        const target = parseInt(el.dataset.value);
        const duration = 1500;
        const start = 0;
        const startTime = performance.now();

        function update(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeOutQuart = 1 - Math.pow(1 - progress, 4);
            const current = Math.floor(start + (target - start) * easeOutQuart);

            el.textContent = current;

            if (progress < 1) {
                requestAnimationFrame(update);
            }
        }

        requestAnimationFrame(update);
    });
}

// Initialize metrics animation after a short delay
setTimeout(animateMetrics, 1500);

// Expose functions globally
window.handleContact = handleContact;
window.showToast = showToast;
