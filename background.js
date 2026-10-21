// Background service worker for Carimbo Extension

// Configuração padrão aplicada na primeira instalação
const defaultConfig = {
    signature: '',
    signatureFormat: ['mono'],
    shortcut: { key: 'Tab', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false },
    breakCount: 2,
    autoSign: true,
    showDate: false,
    showTime: false,
    language: 'pt-BR'
};

// Recarrega as abas abertas do WhatsApp.
// O reload é necessário porque o handler injetado na página não pode ter seus
// listeners removidos por uma nova injeção — reinjetar sem recarregar deixaria
// duas versões do handler ativas ao mesmo tempo (inserção duplicada do carimbo).
async function reloadOpenWhatsAppTabs() {
    let tabs;
    try {
        tabs = await chrome.tabs.query({ url: 'https://web.whatsapp.com/*' });
    } catch (error) {
        console.error('[Carimbo] Erro ao buscar abas do WhatsApp:', error);
        return;
    }

    if (!tabs || tabs.length === 0) {
        //console.log('[Carimbo] Nenhuma aba do WhatsApp aberta para recarregar.');
        return;
    }

    for (const tab of tabs) {
        if (typeof tab.id !== 'number') {
            continue;
        }

        try {
            await chrome.tabs.reload(tab.id);
            //console.log(`[Carimbo] Aba do WhatsApp recarregada: ${tab.id}`);
        } catch (error) {
            console.error(`[Carimbo] Erro ao recarregar aba ${tab.id}:`, error);
        }
    }
}

function openPopupPage() {
    chrome.tabs.create({ url: chrome.runtime.getURL('popup.html?view=page') })
        .catch(error => console.error('[Carimbo] Erro ao abrir tela de configuração:', error));
}

// Preenche apenas as chaves ausentes na primeira instalação.
// Não sobrescreve a config existente: ao recarregar uma extensão não publicada
// (fluxo de desenvolvimento), o Chrome dispara onInstalled com reason "install"
// e um set() direto apagaria a assinatura já configurada pelo usuário.
async function aplicarConfigPadrao() {
    const atual = await chrome.storage.local.get(Object.keys(defaultConfig));
    const faltantes = {};
    for (const key of Object.keys(defaultConfig)) {
        if (atual[key] === undefined) {
            faltantes[key] = defaultConfig[key];
        }
    }
    if (Object.keys(faltantes).length > 0) {
        await chrome.storage.local.set(faltantes);
        //console.log('[Carimbo] Configuração padrão aplicada:', faltantes);
    }
}

chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        aplicarConfigPadrao()
            .then(() => {
                openPopupPage();
                reloadOpenWhatsAppTabs();
            })
            .catch(error => {
                console.error('[Carimbo] Erro ao definir configuração padrão:', error);
            });
        return;
    }

    if (details.reason === 'update') {
        reloadOpenWhatsAppTabs();
    }
});

//console.log('[Carimbo] Service worker iniciado');
