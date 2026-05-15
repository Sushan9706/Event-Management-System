/**
 * VoiceSearch Class
 * A modular implementation of the Web Speech API for voice-to-text search.
 */
class VoiceSearch {
    constructor(options = {}) {
        this.inputElement = options.inputElement;
        this.micButton = options.micButton;
        this.statusElement = options.statusElement;
        this.onResult = options.onResult || (() => {});
        this.onError = options.onError || (() => {});
        
        this.recognition = null;
        this.isListening = false;
        
        this.init();
    }

    /**
     * Initialize Speech Recognition with cross-browser support
     */
    init() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        
        if (!SpeechRecognition) {
            console.error('Speech Recognition API not supported in this browser.');
            this.updateStatus('Browser not supported', true);
            if (this.micButton) this.micButton.style.display = 'none';
            return;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.continuous = false; // Stop when user stops speaking
        this.recognition.interimResults = true; // Show results as they come
        this.recognition.lang = 'en-US';

        this.setupEventListeners();
    }

    setupEventListeners() {
        this.recognition.onstart = () => {
            this.isListening = true;
            this.updateUI(true);
            this.updateStatus('Listening...');
        };

        this.recognition.onresult = (event) => {
            const transcript = Array.from(event.results)
                .map(result => result[0])
                .map(result => result.transcript)
                .join('');

            if (this.inputElement) {
                this.inputElement.value = transcript;
                // Trigger input event so existing search logic picks it up
                this.inputElement.dispatchEvent(new Event('input', { bubbles: true }));
            }
        };

        this.recognition.onerror = (event) => {
            this.isListening = false;
            this.updateUI(false);
            
            let message = 'Error occurred';
            switch (event.error) {
                case 'not-allowed':
                    message = 'Microphone access denied';
                    break;
                case 'no-speech':
                    message = 'No speech detected';
                    break;
                case 'network':
                    message = 'Network error';
                    break;
                default:
                    message = `Error: ${event.error}`;
            }
            
            this.updateStatus(message, true);
            this.onError(event.error);
        };

        this.recognition.onend = () => {
            this.isListening = false;
            this.updateUI(false);
            
            // Wait a bit before hiding status if it's not an error
            if (!this.statusElement.classList.contains('voice-error')) {
                setTimeout(() => {
                    this.statusElement.classList.remove('show');
                }, 2000);
            }

            // Trigger search callback
            this.onResult(this.inputElement.value);
        };

        if (this.micButton) {
            this.micButton.addEventListener('click', () => this.toggleListening());
        }
    }

    toggleListening() {
        if (this.isListening) {
            this.stop();
        } else {
            this.start();
        }
    }

    start() {
        if (!this.recognition) return;
        try {
            this.recognition.start();
        } catch (e) {
            console.error('Recognition already started', e);
        }
    }

    stop() {
        if (!this.recognition) return;
        this.recognition.stop();
    }

    updateUI(isListening) {
        if (this.micButton) {
            if (isListening) {
                this.micButton.classList.add('active');
            } else {
                this.micButton.classList.remove('active');
            }
        }
    }

    updateStatus(message, isError = false) {
        if (this.statusElement) {
            const textEl = this.statusElement.querySelector('.status-text');
            const dotsEl = this.statusElement.querySelector('.dots');
            
            if (textEl) textEl.textContent = message;
            
            if (isError) {
                this.statusElement.classList.add('voice-error');
                if (dotsEl) dotsEl.style.display = 'none';
            } else {
                this.statusElement.classList.remove('voice-error');
                if (dotsEl) dotsEl.style.display = 'flex';
            }
            
            this.statusElement.classList.add('show');
        }
    }
}

// Initialize on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('heroSearch') || document.getElementById('venueSearch');
    const micBtn = document.getElementById('voiceSearchBtn');
    const voiceStatus = document.getElementById('voiceStatus');

    if (searchInput && micBtn) {
        new VoiceSearch({
            inputElement: searchInput,
            micButton: micBtn,
            statusElement: voiceStatus,
            onResult: (text) => {
                if (text.trim()) {
                    // If the input is inside a form (like on the landing page), submit it
                    const form = heroSearch.closest('form');
                    if (form && form.getAttribute('action')) {
                        setTimeout(() => form.submit(), 500);
                    }
                }
            }
        });
    }
});
