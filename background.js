// Background service worker for Carimbo Extension

// Default configuration
const defaultConfig = {
    signature: '',
    signatureFormat: ['mono'],
    shortcut: { key: 'Tab', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false },
    breakCount: 2,
    autoSign: false,
    showDate: false,
    showTime: false
};

// Initialize extension - set default config on first install
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        chrome.storage.local.set(defaultConfig)
            .then(() => {
                console.log('[Carimbo] Configuracao padrao aplicada:', defaultConfig);
            })
            .catch(error => {
                console.error('[Carimbo] Erro ao definir configuracao padrao:', error);
            });
    }
});

console.log('[Carimbo] Service worker iniciado');
