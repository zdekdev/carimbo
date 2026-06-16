// Background service worker for Carimbo Extension

// Default configuration
const defaultConfig = {
    signature: '',
    signatureFormat: ['mono'],
    shortcut: { key: 'Tab', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false },
    breakCount: 2,
    autoSign: true,
    showDate: false,
    showTime: false
};

function reloadOpenWhatsAppTabs() {
    chrome.tabs.query({ url: 'https://web.whatsapp.com/*' }, (tabs) => {
        if (chrome.runtime.lastError) {
            console.error('[Carimbo] Erro ao buscar abas do WhatsApp:', chrome.runtime.lastError);
            return;
        }

        if (!tabs || tabs.length === 0) {
            //console.log('[Carimbo] Nenhuma aba do WhatsApp aberta para recarregar.');
            return;
        }

        tabs.forEach((tab) => {
            if (typeof tab.id !== 'number') {
                return;
            }

            chrome.tabs.reload(tab.id, () => {
                if (chrome.runtime.lastError) {
                    console.error(`[Carimbo] Erro ao recarregar aba ${tab.id}:`, chrome.runtime.lastError);
                    return;
                }

                //console.log(`[Carimbo] Aba do WhatsApp recarregada: ${tab.id}`);
            });
        });
    });
}

function openPopupPage() {
    chrome.tabs.create({ url: chrome.runtime.getURL('popup.html?view=page') }, (tab) => {
        if (chrome.runtime.lastError) {
            console.error('[Carimbo] Erro ao abrir tela de configuracao:', chrome.runtime.lastError);
            return;
        }

        //console.log('[Carimbo] Tela de configuracao aberta:', tab && tab.id);
    });
}

// Initialize extension - set default config on first install
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        chrome.storage.local.set(defaultConfig)
            .then(() => {
                //console.log('[Carimbo] Configuracao padrao aplicada:', defaultConfig);
                openPopupPage();
                reloadOpenWhatsAppTabs();
            })
            .catch(error => {
                console.error('[Carimbo] Erro ao definir configuracao padrao:', error);
            });
        return;
    }

    if (details.reason === 'update') {      
        reloadOpenWhatsAppTabs();
    }
});

//console.log('[Carimbo] Service worker iniciado');
