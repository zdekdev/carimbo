// Background service worker for WhatsApp Signature Extension

// Default configuration
const defaultConfig = {
    signature: '',
    signatureFormat: null,
    shortcut: 'Tab',
    breakCount: 2
};

// Initialize extension - set default config on first install
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        chrome.storage.local.set(defaultConfig)
            .then(() => {
                console.log('[WhatsApp Signature] Configuracao padrao aplicada:', defaultConfig);
            })
            .catch(error => {
                console.error('[WhatsApp Signature] Erro ao definir configuracao padrao:', error);
            });
    }
});

console.log('[WhatsApp Signature] Service worker iniciado');
