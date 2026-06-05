// Content script for WhatsApp Signature Extension
// Gerencia a config (storage) e injeta page-handler.js no contexto da pagina
(function() {
    'use strict';

    let config = {
        signature: '',
        shortcut: 'Tab',
        breakCount: 2,
        autoSign: false,
        showDate: false,
        showTime: false
    };

    // Envia config atualizada para o script injetado na pagina
    function enviarConfigParaPagina() {
        window.postMessage({
            type: 'WHATSAPP_SIGNATURE_CONFIG',
            signature: config.signature,
            shortcut: config.shortcut,
            breakCount: config.breakCount,
            autoSign: config.autoSign,
            showDate: config.showDate,
            showTime: config.showTime
        }, '*');
        console.log('[WhatsApp Signature] Config enviada para pagina:', config);
    }

    // Escuta o page-handler.js pedindo a config (resolve problema de timing)
    window.addEventListener('message', function(event) {
        if (!event.data || event.data.type !== 'WHATSAPP_SIGNATURE_READY') return;
        console.log('[WhatsApp Signature] page-handler.js esta pronto, enviando config...');
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
            console.log('[WhatsApp Signature] Config carregada do storage:', config);
            enviarConfigParaPagina();
        } catch (error) {
            console.error('[WhatsApp Signature] Erro ao carregar config:', error);
        }
    }

    // Atualiza config em tempo real quando o popup salva alteracoes
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local') {
            if (changes.signature) {
                config.signature = changes.signature.newValue;
                console.log('[WhatsApp Signature] Assinatura atualizada:', config.signature);
            }
            if (changes.shortcut) {
                config.shortcut = changes.shortcut.newValue;
                console.log('[WhatsApp Signature] Atalho atualizado:', config.shortcut);
            }
            if (changes.breakCount) {
                config.breakCount = changes.breakCount.newValue;
                console.log('[WhatsApp Signature] Quebras de linha atualizadas:', config.breakCount);
            }
            if (changes.autoSign) {
                config.autoSign = changes.autoSign.newValue;
                console.log('[WhatsApp Signature] Assinatura automatica atualizada:', config.autoSign);
            }
            if (changes.showDate) {
                config.showDate = changes.showDate.newValue;
                console.log('[WhatsApp Signature] Exibir data atualizada:', config.showDate);
            }
            if (changes.showTime) {
                config.showTime = changes.showTime.newValue;
                console.log('[WhatsApp Signature] Exibir hora atualizada:', config.showTime);
            }
            enviarConfigParaPagina();
        }
    });

    // Injeta page-handler.js via <script src="..."> no contexto da pagina
    function injetarHandlerNaPagina() {
        const existente = document.getElementById('whatsapp-signature-inject');
        if (existente) {
            existente.remove();
        }

        const script = document.createElement('script');
        script.id = 'whatsapp-signature-inject';
        script.src = chrome.runtime.getURL('page-handler.js');
        (document.head || document.documentElement).appendChild(script);
        console.log('[WhatsApp Signature] Tag <script src="page-handler.js"> injetada');
    }

    injetarHandlerNaPagina();

    loadConfig().then(() => {
        console.log('[WhatsApp Signature] Extensao inicializada com sucesso');
    }).catch(err => {
        console.error('[WhatsApp Signature] Falha na inicializacao:', err);
    });
})();
