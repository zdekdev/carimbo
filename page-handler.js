// Script injetado no contexto da pagina do WhatsApp Web
// Executa no MESMO contexto que o WhatsApp, permitindo que
// stopImmediatePropagation() bloqueie os handlers nativos
(function() {
    'use strict';

    let _config = {
        signature: '',
        shortcut: 'Tab',
        breakCount: 2
    };

    function aplicarConfig(data) {
        if (data.signature !== undefined) {
            _config.signature = data.signature;
        }
        if (data.shortcut !== undefined) {
            _config.shortcut = data.shortcut;
        }
        if (data.breakCount !== undefined && data.breakCount !== null) {
            _config.breakCount = data.breakCount;
        }
        console.log('[WhatsApp Signature - Page] Config aplicada:', JSON.stringify(_config));
    }

    // Recebe config atualizada do content script via postMessage
    window.addEventListener('message', function(event) {
        if (!event.data || event.data.type !== 'WHATSAPP_SIGNATURE_CONFIG') return;
        aplicarConfig(event.data);
    });

    // Pede a config assim que carrega (resolve o problema de timing)
    window.postMessage({ type: 'WHATSAPP_SIGNATURE_READY' }, '*');
    console.log('[WhatsApp Signature - Page] Aguardando config do content script...');

    function encontrarPrimeiroNoTexto(elemento) {
        const walker = document.createTreeWalker(
            elemento,
            NodeFilter.SHOW_TEXT,
            null
        );
        let node = walker.firstChild();
        while (node && node.textContent.trim() === '') {
            node = walker.nextNode();
        }
        return node;
    }

    function posicionarCursor(elemento, noInicio) {
        const selection = window.getSelection();
        if (!selection) return;

        const range = document.createRange();

        if (noInicio) {
            const primeiroNo = encontrarPrimeiroNoTexto(elemento);
            if (primeiroNo) {
                range.setStart(primeiroNo, 0);
                range.collapse(true);
            } else {
                range.selectNodeContents(elemento);
                range.collapse(true);
            }
        } else {
            range.selectNodeContents(elemento);
            range.collapse(false);
        }

        selection.removeAllRanges();
        selection.addRange(range);
    }

    function campoPossuiTexto(elemento) {
        const texto = elemento.textContent || '';
        return texto.trim().length > 0;
    }

    function assinaturaJaExiste(elemento) {
        if (!_config.signature) return false;
        const texto = elemento.textContent || '';
        return texto.includes(_config.signature);
    }

    function simularShiftEnter(elemento) {
        const eventoConfig = {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            shiftKey: true,
            bubbles: true,
            cancelable: true
        };

        elemento.dispatchEvent(new KeyboardEvent('keydown', eventoConfig));
        elemento.dispatchEvent(new KeyboardEvent('keyup', eventoConfig));
    }

    function interceptarAtalho(evento) {
        const campo = evento.target;

        if (!campo || !campo.matches('div[contenteditable="true"][data-tab="10"], div[data-lexical-editor="true"]')) {
            return;
        }

        if (evento.key !== _config.shortcut) {
            return;
        }

        if (!_config.signature || _config.signature.trim() === '') {
            return;
        }

        evento.preventDefault();
        evento.stopImmediatePropagation();

        if (assinaturaJaExiste(campo)) {
            return;
        }

        campo.focus();

        const temTexto = campoPossuiTexto(campo);

        if (temTexto) {
            posicionarCursor(campo, true);
            document.execCommand('insertText', false, _config.signature);
        } else {
            posicionarCursor(campo, false);
            document.execCommand('insertText', false, _config.signature);
        }

        // Aplica a quantidade configurada de quebras de linha
        const quebras = _config.breakCount || 2;
        for (let i = 0; i < quebras; i++) {
            simularShiftEnter(campo);
        }

        campo.dispatchEvent(new Event('input', { bubbles: true }));
    }

    window.addEventListener('keydown', interceptarAtalho, true);
    console.log('[WhatsApp Signature - Page] Handler injetado e ativo');
})();
