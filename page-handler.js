// Script injetado no contexto da pagina do WhatsApp Web
// Executa no MESMO contexto que o WhatsApp, permitindo que
// stopImmediatePropagation() bloqueie os handlers nativos
(function() {
    'use strict';

    var _config = {
        signature: '',
        shortcut: 'Tab',
        breakCount: 2,
        autoSign: false,
        showDate: false,
        showTime: false
    };

    // Rastreia elementos onde o carimbo ja foi inserido automaticamente
    var _camposProcessados = new WeakSet();

    // Selector do campo de chat do WhatsApp
    var CAMPO_SELECTOR = 'div[contenteditable="true"][data-tab="10"], div[data-lexical-editor="true"]';

    function aplicarConfig(data) {
        var changed = false;
        if (data.signature !== undefined && _config.signature !== data.signature) {
            _config.signature = data.signature;
            changed = true;
        }
        if (data.shortcut !== undefined) {
            _config.shortcut = data.shortcut;
        }
        if (data.breakCount !== undefined && data.breakCount !== null) {
            _config.breakCount = data.breakCount;
        }
        if (data.autoSign !== undefined && _config.autoSign !== data.autoSign) {
            _config.autoSign = data.autoSign;
            changed = true;
        }
        if (data.showDate !== undefined) {
            _config.showDate = data.showDate;
        }
        if (data.showTime !== undefined) {
            _config.showTime = data.showTime;
        }
        console.log('[Carimbo] Config aplicada:', JSON.stringify(_config));

        // Se autoSign foi ativado, tenta carimbar em campos ja visiveis (nao processados)
        if (changed && _config.autoSign && _config.signature) {
            tentarAutoCarimbarCamposExistentes();
        }
    }

    // Recebe config atualizada do content script via postMessage
    window.addEventListener('message', function(event) {
        if (!event.data || event.data.type !== 'CARIMBO_CONFIG') return;
        aplicarConfig(event.data);
    });

    // Pede a config assim que carrega (resolve o problema de timing)
    window.postMessage({ type: 'CARIMBO_READY' }, '*');
    console.log('[Carimbo] Aguardando config do content script...');

    // ====================
    // Helper functions
    // ====================
    function encontrarPrimeiroNoTexto(elemento) {
        var walker = document.createTreeWalker(
            elemento,
            NodeFilter.SHOW_TEXT,
            null
        );
        var node = walker.firstChild();
        while (node && node.textContent.trim() === '') {
            node = walker.nextNode();
        }
        return node;
    }

    function posicionarCursor(elemento, noInicio) {
        var selection = window.getSelection();
        if (!selection) return;

        var range = document.createRange();

        if (noInicio) {
            var primeiroNo = encontrarPrimeiroNoTexto(elemento);
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
        var texto = elemento.textContent || '';
        return texto.trim().length > 0;
    }

    function carimboJaExiste(elemento) {
        if (!_config.signature) return false;
        var texto = elemento.textContent || '';
        return texto.includes(_config.signature);
    }

    function carimboTemConteudo() {
        if (!_config.signature) return false;
        var plain = _config.signature
            .replace(/\*([^*\n]+?)\*/g, '$1')
            .replace(/_([^_\n]+?)_/g, '$1')
            .replace(/~([^~\n]+?)~/g, '$1')
            .replace(/`([^`\n]+?)`/g, '$1')
            .trim();
        return plain.length > 0;
    }

    function simularShiftEnter(elemento) {
        var eventoConfig = {
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

    function reWrapWithMarkers(plainText, originalMd) {
        var result = plainText;
        var markers = extractOuterMarkers(originalMd);
        // Re-aplica na ordem inversa (ultimos extraidos = mais internos)
        for (var i = markers.length - 1; i >= 0; i--) {
            result = markers[i] + result + markers[i];
        }
        return result;
    }

    function extractOuterMarkers(text) {
        var markers = [];
        var remaining = text;
        var fmtOrder = ['bold', 'italic', 'strikethrough', 'mono'];
        var markerMap = { bold: '*', italic: '_', strikethrough: '~', mono: '`' };

        for (var i = 0; i < fmtOrder.length; i++) {
            var marker = markerMap[fmtOrder[i]];
            if (remaining.startsWith(marker) && remaining.endsWith(marker) && remaining.length >= marker.length * 2 + 1) {
                markers.push(marker);
                remaining = remaining.slice(marker.length, -marker.length);
            }
        }
        return markers;
    }

    function inserirCarimbo(campo) {
        campo.focus();

        // Monta texto do carimbo com data/hora se ativados
        var textoCarimbo = _config.signature;
        var dtParts = [];
        if (_config.showDate) {
            var now = new Date();
            var day = String(now.getDate()).padStart(2, '0');
            var month = String(now.getMonth() + 1).padStart(2, '0');
            var year = now.getFullYear();
            dtParts.push(day + '-' + month + '-' + year);
        }
        if (_config.showTime) {
            var now2 = new Date();
            var hours = String(now2.getHours()).padStart(2, '0');
            var minutes = String(now2.getMinutes()).padStart(2, '0');
            dtParts.push(hours + ':' + minutes);
        }
        if (dtParts.length > 0 && textoCarimbo) {
            // Extrai texto puro, anexa data/hora, re-aplica os mesmos marcadores
            var plain = textoCarimbo
                .replace(/\*([^*\n]+?)\*/g, '$1')
                .replace(/_([^_\n]+?)_/g, '$1')
                .replace(/~([^~\n]+?)~/g, '$1')
                .replace(/`([^`\n]+?)`/g, '$1')
                .trim();
            var dtSuffix = ' ' + dtParts.join(' ');
            textoCarimbo = reWrapWithMarkers(plain + dtSuffix, textoCarimbo.trim());
        }

        if (campoPossuiTexto(campo)) {
            posicionarCursor(campo, true);
            document.execCommand('insertText', false, textoCarimbo);
        } else {
            posicionarCursor(campo, false);
            document.execCommand('insertText', false, textoCarimbo);
        }

        var quebras = _config.breakCount || 2;
        for (var i = 0; i < quebras; i++) {
            simularShiftEnter(campo);
        }

        campo.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // ====================
    // Normaliza o valor da tecla para comparacao consistente
    // ====================
    function normalizarTecla(key) {
        if (!key) return '';
        if (key.length === 1) return key.toLowerCase();
        return key;
    }

    // ====================
    // Verifica se o evento de teclado corresponde ao atalho configurado
    // Suporta tanto o formato antigo (string) quanto o novo (objeto com modificadores)
    // ====================
    function atalhoCorresponde(evento, shortcut) {
        // Formato antigo: string simples, sem modificadores
        if (typeof shortcut === 'string') {
            return normalizarTecla(evento.key) === normalizarTecla(shortcut) &&
                   !evento.ctrlKey && !evento.shiftKey && !evento.altKey && !evento.metaKey;
        }

        // Formato novo: objeto com key + modificadores
        if (typeof shortcut === 'object' && shortcut.key !== undefined) {
            return normalizarTecla(evento.key) === normalizarTecla(shortcut.key) &&
                   !!evento.ctrlKey === !!shortcut.ctrlKey &&
                   !!evento.shiftKey === !!shortcut.shiftKey &&
                   !!evento.altKey === !!shortcut.altKey &&
                   !!evento.metaKey === !!shortcut.metaKey;
        }

        return false;
    }

    // ====================
    // Intercepta atalho manual (BLOQUEADO se autoSign ativo)
    // ====================
    function interceptarAtalho(evento) {
        // Se autoSign esta ativo, nao permite insercao manual via atalho
        if (_config.autoSign) {
            return;
        }

        var target = evento.target;
        if (!target || !target.closest) return;

        var campo = target.closest(CAMPO_SELECTOR);
        if (!campo) {
            return;
        }

        if (!atalhoCorresponde(evento, _config.shortcut)) {
            return;
        }

        if (!carimboTemConteudo()) {
            return;
        }

        // Bloqueia o comportamento padrao do navegador para esta combinacao
        evento.preventDefault();
        evento.stopImmediatePropagation();

        if (carimboJaExiste(campo)) {
            return;
        }

        inserirCarimbo(campo);
    }

    // ====================
    // Auto-insert: carimba automaticamente ao abrir chat
    // ====================
    function tentarAutoCarimbar(campo) {
        if (!_config.autoSign) return;
        if (!carimboTemConteudo()) return;
        if (_camposProcessados.has(campo)) return;
        if (carimboJaExiste(campo)) {
            _camposProcessados.add(campo);
            return;
        }
        // So insere se o usuario ja digitou algo no campo
        if (!campoPossuiTexto(campo)) return;

        _camposProcessados.add(campo);
        inserirCarimbo(campo);
    }

    function tentarAutoCarimbarCamposExistentes() {
        var campos = document.querySelectorAll(CAMPO_SELECTOR);
        for (var i = 0; i < campos.length; i++) {
            var campo = campos[i];
            if (!campoPossuiTexto(campo)) {
                _camposProcessados.delete(campo);
            } else {
                tentarAutoCarimbar(campo);
            }
        }
    }

    // MutationObserver: detecta novos campos de chat
    function iniciarObserver() {
        var timeout = null;

        var observer = new MutationObserver(function(mutations) {
            // Debounce: processa em batch via rAF
            if (timeout) return;
            timeout = requestAnimationFrame(function() {
                timeout = null;
                var campos = document.querySelectorAll(CAMPO_SELECTOR);
                for (var i = 0; i < campos.length; i++) {
                    var campo = campos[i];
                    if (!campoPossuiTexto(campo)) {
                        _camposProcessados.delete(campo);
                    } else {
                        tentarAutoCarimbar(campo);
                    }
                }
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        console.log('[Carimbo] MutationObserver iniciado');
    }

    // ====================
    // Listener de input: detecta quando o usuario digita no campo
    // para disparar o auto-insert (evita inserir ao abrir chat vazio)
    // ====================
    function iniciarInputListener() {
        document.body.addEventListener('input', function(event) {
            var target = event.target;
            if (!target || !target.closest) return;
            
            var campo = target.closest(CAMPO_SELECTOR);
            if (!campo) return;

            if (!campoPossuiTexto(campo)) {
                _camposProcessados.delete(campo);
            } else {
                tentarAutoCarimbar(campo);
            }
        }, { passive: true });
    }

    // ====================
    // Init
    // ====================
    window.addEventListener('keydown', interceptarAtalho, true);
    iniciarObserver();
    iniciarInputListener();
    console.log('[Carimbo] Handler injetado e ativo');
})();
