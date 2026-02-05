/**
 * Login Page JavaScript
 * Handles login functionality, animations, and dashboard preview
 */

// DOM Elements
const loginForm = document.getElementById('loginForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const dashboardPreview = document.getElementById('dashboardPreview');
const loginCard = document.querySelector('.login-card');
const toast = document.getElementById('toast');
const previewChart = document.getElementById('previewChart');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initScrollReveal();
    initInputValidation();
    initPreviewChart();
    checkAuthStatus();
});

/**
 * Initialize scroll reveal animations
 */
function initScrollReveal() {
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
}

/**
 * Initialize input validation
 */
function initInputValidation() {
    emailInput.addEventListener('input', validateEmail);
    passwordInput.addEventListener('input', validatePassword);
}

/**
 * Validate email input
 */
function validateEmail() {
    const email = emailInput.value;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const icon = emailInput.parentElement.querySelector('.input-icon');
    
    if (email && emailRegex.test(email)) {
        icon.innerHTML = '<i class="fas fa-check-circle" style="color: var(--success);"></i>';
        return true;
    } else if (email) {
        icon.innerHTML = '<i class="fas fa-exclamation-circle" style="color: var(--warning);"></i>';
        return false;
    } else {
        icon.innerHTML = '<i class="fas fa-check-circle"></i>';
        return false;
    }
}

/**
 * Validate password input
 */
function validatePassword() {
    const password = passwordInput.value;
    
    if (password.length >= 8) {
        return true;
    }
    return false;
}

/**
 * Toggle password visibility
 */
function togglePassword() {
    const icon = passwordInput.parentElement.querySelector('.toggle-password i');
    
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        passwordInput.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}

/**
 * Handle login form submission
 */
function handleLogin(event) {
    event.preventDefault();
    
    const email = emailInput.value;
    const password = passwordInput.value;
    
    // Validate inputs
    if (!email || !password) {
        showToast('Please fill in all fields', 'error');
        return;
    }
    
    // Show loading state
    const loginBtn = loginForm.querySelector('.login-btn');
    loginBtn.classList.add('loading');
    
    // Simulate API call
    setTimeout(() => {
        // Demo: Accept any credentials
        if (email && password.length >= 4) {
            // Store auth state
            localStorage.setItem('isLoggedIn', 'true');
            localStorage.setItem('userEmail', email);
            localStorage.setItem('userName', email.split('@')[0]);
            
            // Show success
            showToast('Login successful! Redirecting...', 'success');
            
            // Animate transition to dashboard
            setTimeout(() => {
                animateToDashboard();
            }, 1000);
        } else {
            showToast('Invalid credentials', 'error');
            loginBtn.classList.remove('loading');
        }
    }, 1500);
}

/**
 * Animate transition to dashboard preview
 */
function animateToDashboard() {
    // Fade out login card
    loginCard.style.opacity = '0';
    loginCard.style.transform = 'translateX(-50px)';
    loginCard.style.transition = 'all 0.5s ease';
    
    // Show dashboard preview
    dashboardPreview.classList.remove('hidden');
    dashboardPreview.classList.add('show');
    
    // Fade in dashboard
    setTimeout(() => {
        dashboardPreview.style.opacity = '1';
        dashboardPreview.style.transform = 'translateX(0)';
        
        // Redirect to main dashboard after animation
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 2000);
    }, 100);
}

/**
 * Handle social login
 */
function socialLogin(provider) {
    showToast(`Signing in with ${provider}...`, 'info');
    
    setTimeout(() => {
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('userEmail', `user@${provider}.com`);
        localStorage.setItem('userName', `${provider} user`);
        
        showToast('Login successful! Redirecting...', 'success');
        
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 1500);
    }, 1000);
}

/**
 * Switch to register (placeholder)
 */
function switchToRegister() {
    showToast('Registration form coming soon!', 'info');
}

/**
 * Check if user is already logged in
 */
function checkAuthStatus() {
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    
    if (isLoggedIn) {
        // User is already logged in, redirect to dashboard
        window.location.href = 'dashboard.html';
    }
}

/**
 * Initialize preview chart
 */
function initPreviewChart() {
    if (!previewChart) return;
    
    const ctx = previewChart.getContext('2d');
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            datasets: [{
                label: 'Heart Rate',
                data: [72, 75, 68, 74, 71, 69, 73],
                borderColor: '#ef4444',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 0,
                pointHoverRadius: 4
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
                    display: true,
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#64748b',
                        font: {
                            size: 10
                        }
                    }
                },
                y: {
                    display: true,
                    min: 60,
                    max: 90,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    },
                    ticks: {
                        color: '#64748b',
                        font: {
                            size: 10
                        }
                    }
                }
            },
            animation: {
                duration: 2000,
                easing: 'easeOutQuart'
            }
        }
    });
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-times-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    
    toast.querySelector('.toast-icon').className = `toast-icon fas ${icons[type]}`;
    toast.querySelector('.toast-message').textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 4000);
}

/**
 * Logout user
 */
function logout() {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userName');
    
    window.location.href = 'login.html';
}

// Expose functions globally
window.handleLogin = handleLogin;
window.togglePassword = togglePassword;
window.socialLogin = socialLogin;
window.switchToRegister = switchToRegister;
window.logout = logout;
