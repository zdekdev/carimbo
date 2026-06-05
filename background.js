// Background service worker for WhatsApp Signature Extension

// Default configuration
const defaultConfig = {
    signature: '',
    signatureFormat: [],
    shortcut: { key: 'Tab', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false },
    breakCount: 2,
    autoSign: false
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
