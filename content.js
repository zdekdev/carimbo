// Content script for Carimbo Extension
// Gerencia a config (storage) e injeta page-handler.js no contexto da página
(function() {
    'use strict';

    let config = {
        signature: '',
        shortcut: { key: 'Tab', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false },
        breakCount: 2,
        autoSign: true,
        showDate: false,
        showTime: false
    };

    // Envia config atualizada para o script injetado na página
    function enviarConfigParaPagina() {
        window.postMessage({
            type: 'CARIMBO_CONFIG',
            signature: config.signature,
            shortcut: config.shortcut,
            breakCount: config.breakCount,
            autoSign: config.autoSign,
            showDate: config.showDate,
            showTime: config.showTime
        }, '*');
        //console.log('[Carimbo] Config enviada para página:', config);
    }

    // Escuta o page-handler.js pedindo a config (resolve o problema de sincronização)
    window.addEventListener('message', function(event) {
        if (event.source !== window) return; // ignora mensagens de iframes/scripts de terceiros
        if (!event.data || event.data.type !== 'CARIMBO_READY') return;
        //console.log('[Carimbo] page-handler.js está pronto, enviando config...');
        enviarConfigParaPagina();
    });

    // Carrega config do storage
    async function loadConfig() {
        try {
            const result = await chrome.storage.local.get(['signature', 'shortcut', 'breakCount', 'autoSign', 'showDate', 'showTime']);
            if (result.signature !== undefined) {
                config.signature = result.signature;
            }
            if (result.shortcut !== undefined) {
                config.shortcut = result.shortcut;
            }
            if (result.breakCount !== undefined && result.breakCount !== null) {
                config.breakCount = result.breakCount;
            }
            if (result.autoSign !== undefined) {
                config.autoSign = result.autoSign;
            }
            if (result.showDate !== undefined) {
                config.showDate = result.showDate;
            }
            if (result.showTime !== undefined) {
                config.showTime = result.showTime;
            }
            //console.log('[Carimbo] Config carregada do storage:', config);
            enviarConfigParaPagina();
        } catch (error) {
            console.error('[Carimbo] Erro ao carregar config:', error);
        }
    }

    // Atualiza config em tempo real quando o popup salva alterações
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local') {
            if (changes.signature) {
                config.signature = changes.signature.newValue;
                //console.log('[Carimbo] Texto atualizado:', config.signature);
            }
            if (changes.shortcut) {
                config.shortcut = changes.shortcut.newValue;
                //console.log('[Carimbo] Atalho atualizado:', config.shortcut);
            }
            if (changes.breakCount) {
                config.breakCount = changes.breakCount.newValue;
                //console.log('[Carimbo] Quebras de linha atualizadas:', config.breakCount);
            }
            if (changes.autoSign) {
                config.autoSign = changes.autoSign.newValue;
                //console.log('[Carimbo] Texto automático atualizado:', config.autoSign);
            }
            if (changes.showDate) {
                config.showDate = changes.showDate.newValue;
                //console.log('[Carimbo] Exibir data atualizada:', config.showDate);
            }
            if (changes.showTime) {
                config.showTime = changes.showTime.newValue;
                //console.log('[Carimbo] Exibir hora atualizada:', config.showTime);
            }
            enviarConfigParaPagina();
        }
    });

    // Injeta page-handler.js via <script src="..."> no contexto da página
    function injetarHandlerNaPagina() {
        const existente = document.getElementById('carimbo-inject');
        if (existente) {
            existente.remove();
        }

        const script = document.createElement('script');
        script.id = 'carimbo-inject';
        script.src = chrome.runtime.getURL('page-handler.js');
        (document.head || document.documentElement).appendChild(script);
        //console.log('[Carimbo] Tag <script src="page-handler.js"> injetada');
    }

    injetarHandlerNaPagina();

    loadConfig().then(() => {
        //console.log('[Carimbo] Extensão inicializada com sucesso');
    }).catch(err => {
        console.error('[Carimbo] Falha na inicialização:', err);
    });
})();
