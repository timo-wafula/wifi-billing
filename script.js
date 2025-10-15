class WiFiBilling {
    constructor() {
        this.selectedPackage = null;
        this.init();
    }

    init() {
        this.bindEvents();
        this.getClientInfo();
    }

    bindEvents() {
        // Package selection
        document.querySelectorAll('.package').forEach(pkg => {
            pkg.addEventListener('click', () => this.selectPackage(pkg));
        });

        // Payment form submission
        document.getElementById('paymentForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.processPayment();
        });
    }

    getClientInfo() {
        // Get client MAC and IP from router parameters
        const urlParams = new URLSearchParams(window.location.search);
        this.mac = urlParams.get('mac') || this.generateMockMac();
        this.ip = urlParams.get('ip') || '192.168.100.100';
    }

    generateMockMac() {
        return 'AA:BB:CC:' + Array.from({length: 6}, () => 
            Math.floor(Math.random() * 16).toString(16)).join(':').toUpperCase();
    }

    selectPackage(pkg) {
        // Remove previous selection
        document.querySelectorAll('.package').forEach(p => p.classList.remove('selected'));
        
        // Add selection to clicked package
        pkg.classList.add('selected');
        
        this.selectedPackage = {
            price: pkg.dataset.price,
            duration: pkg.dataset.duration
        };

        // Update payment form
        document.getElementById('selectedPackage').textContent = `${pkg.dataset.price} KES - ${this.getDurationText(pkg.dataset.duration)}`;
        document.getElementById('selectedAmount').textContent = pkg.dataset.price;

        // Show payment form
        document.querySelector('.packages').classList.add('hidden');
        document.querySelector('.payment-form').classList.remove('hidden');
    }

    getDurationText(duration) {
        const hours = parseInt(duration);
        if (hours === 1) return '1 Hour';
        if (hours === 168) return '7 Days';
        if (hours <= 24) return `${hours} Hours`;
        return `${hours / 24} Days`;
    }

    async processPayment() {
        const phone = document.getElementById('phone').value;
        
        if (!this.validatePhone(phone)) {
            alert('Please enter a valid M-Pesa phone number (07XXXXXXXX)');
            return;
        }

        // Show payment status
        document.querySelector('.payment-form').classList.add('hidden');
        document.querySelector('.payment-status').classList.remove('hidden');

        try {
            const paymentData = {
                phone: phone,
                amount: this.selectedPackage.price,
                duration: this.selectedPackage.duration,
                mac: this.mac,
                ip: this.ip,
                timestamp: new Date().toISOString()
            };

            // Send payment request to Google Apps Script
            const response = await this.sendPaymentRequest(paymentData);
            
            if (response.success) {
                this.pollPaymentStatus(response.transactionId);
            } else {
                this.showError(response.message || 'Payment failed. Please try again.');
            }
        } catch (error) {
            this.showError('Network error. Please check your connection and try again.');
        }
    }

    validatePhone(phone) {
        const phoneRegex = /^07\d{8}$/;
        return phoneRegex.test(phone);
    }

    async sendPaymentRequest(paymentData) {
        const GAS_URL = 'https://script.google.com/macros/s/AKfycbyCnTrxmiPV1E_4G7ls_m06R5z0wJgRNAUX1Ekri14EGBASU8jeK91iON-WFMO-B40z/exec'; // Replace with your GAS URL
        
        const response = await fetch(GAS_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(paymentData)
        });

        return await response.json();
    }

    async pollPaymentStatus(transactionId) {
        const maxAttempts = 30; // 2.5 minutes at 5 second intervals
        let attempts = 0;

        const checkStatus = async () => {
            attempts++;
            
            try {
                const GAS_STATUS_URL = 'https://script.google.com/macros/s/AKfycbyCnTrxmiPV1E_4G7ls_m06R5z0wJgRNAUX1Ekri14EGBASU8jeK91iON-WFMO-B40z/exec'; // Replace with your status endpoint
                const response = await fetch(`${GAS_STATUS_URL}?transactionId=${transactionId}`);
                const status = await response.json();

                if (status.paid) {
                    this.showSuccess('Payment successful! You are now being connected...');
                    setTimeout(() => {
                        // Redirect to success page or router acceptance
                        window.location.href = 'http://192.168.100.1/redirect';
                    }, 2000);
                } else if (attempts >= maxAttempts) {
                    this.showError('Payment timeout. Please try again.');
                } else {
                    setTimeout(checkStatus, 5000); // Check every 5 seconds
                }
            } catch (error) {
                if (attempts >= maxAttempts) {
                    this.showError('Unable to verify payment status. Please contact support.');
                } else {
                    setTimeout(checkStatus, 5000);
                }
            }
        };

        checkStatus();
    }

    showSuccess(message) {
        document.querySelector('.payment-status').innerHTML = `
            <div class="status-message">
                <h3 style="color: #28a745;">Success!</h3>
                <p>${message}</p>
            </div>
        `;
    }

    showError(message) {
        document.querySelector('.payment-status').innerHTML = `
            <div class="status-message">
                <h3 style="color: #dc3545;">Error</h3>
                <p>${message}</p>
                <button onclick="location.reload()" class="btn-pay" style="background: #dc3545;">Try Again</button>
            </div>
        `;
    }
}

// Initialize the application
new WiFiBilling();
