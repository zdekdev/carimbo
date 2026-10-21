// Script injetado no contexto da pagina do WhatsApp Web
// Executa no MESMO contexto que o WhatsApp, permitindo que
// stopImmediatePropagation() bloqueie os handlers nativos
(function () {
    'use strict';

    var _config = {
        signature: '',
        shortcut: { key: 'Tab', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false },
        breakCount: 2,
        autoSign: true,
        showDate: false,
        showTime: false
    };

    // Rastreia elementos onde o carimbo já foi inserido automaticamente
    var _camposProcessados = new WeakSet();

    // Cache do texto puro da assinatura (sem marcadores markdown), calculado
    // apenas quando a config muda, para evitar reprocessar regex a cada verificação
    var _assinaturaPura = '';
    var _assinaturaPuraNormalizada = '';

    // Atrasos (ms) para lidar com o editor Lexical, que processa eventos de forma assíncrona
    var ATRASO_INSERCAO = 50;     // espera a seleção estabilizar antes de inserir e reposicionar o cursor
    var ATRASO_DIGITACAO = 60;    // auto-carimbo por digitação: carimbo aparece quase imediatamente
    var ATRASO_POS_COLAGEM = 250; // colagem/arrasto, links e emojis: aguarda o Lexical processar o conteúdo

    // Seletor do campo de chat do WhatsApp
    var CAMPO_SELECTOR = 'div[contenteditable="true"][data-tab="10"], div[data-lexical-editor="true"]';

    function aplicarConfig(data) {
        var changed = false;
        if (data.signature !== undefined && _config.signature !== data.signature) {
            _config.signature = data.signature;
            atualizarCacheAssinatura();
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
       //console.log('[Carimbo] Config aplicada:', JSON.stringify(_config));

        // Se autoSign foi ativado, tenta carimbar em campos já visíveis (não processados)
        if (changed && _config.autoSign && _config.signature) {
            tentarAutoCarimbarCamposExistentes();
        }
    }

    // Recebe config atualizada do content script via postMessage
    window.addEventListener('message', function (event) {
        if (event.source !== window) return; // ignora mensagens de iframes/scripts de terceiros
        if (!event.data || event.data.type !== 'CARIMBO_CONFIG') return;
        aplicarConfig(event.data);
    });

    // Pede a config assim que carrega (resolve o problema de sincronização)
    window.postMessage({ type: 'CARIMBO_READY' }, '*');
    //console.log('[Carimbo] Aguardando config do content script...');

    // ====================
    // Helper functions
    // ====================

    // Remove os marcadores markdown do WhatsApp e devolve o texto puro
    function extrairTextoPuro(md) {
        return md
            .replace(/\*([^*\n]+?)\*/g, '$1')
            .replace(/_([^_\n]+?)_/g, '$1')
            .replace(/~([^~\n]+?)~/g, '$1')
            .replace(/`([^`\n]+?)`/g, '$1')
            .trim();
    }

    // Recalcula o cache do texto puro da assinatura
    function atualizarCacheAssinatura() {
        _assinaturaPura = extrairTextoPuro(_config.signature);
        _assinaturaPuraNormalizada = _assinaturaPura.replace(/\s+/g, ' ');
    }

    // Quantidade de quebras de linha (0 é um valor válido; padrão: 2)
    function obterQuebras() {
        var quebras = _config.breakCount;
        return (typeof quebras === 'number' && quebras >= 0) ? quebras : 2;
    }

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
            // Tenta encontrar o primeiro parágrafo (Lexical editor usa <p>)
            var primeiroP = elemento.querySelector('p');
            if (primeiroP) {
                range.setStart(primeiroP, 0);
                range.collapse(true);
            } else {
                var primeiroNo = encontrarPrimeiroNoTexto(elemento);
                if (primeiroNo) {
                    range.setStart(primeiroNo, 0);
                    range.collapse(true);
                } else {
                    range.selectNodeContents(elemento);
                    range.collapse(true);
                }
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
        if (!_assinaturaPura) return false;

        // Removemos a verificação restrita de regex com crases (``)
        // porque o Lexical formata emojis e links de maneiras que quebram a regex,
        // ou se o usuário não usar crases na assinatura.
        var texto = (elemento.textContent || '').replace(/\s+/g, ' ');

        return texto.includes(_assinaturaPuraNormalizada);
    }

    function carimboTemConteudo() {
        return _assinaturaPura.length > 0;
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

    function textoEhLink(texto) {
        return /^(https?:\/\/|www\.)\S+$/i.test(texto);
    }

    function textoEhEmoji(texto) {
        var semEspacos = texto.replace(/\s+/g, '');
        if (!semEspacos) return false;

        return /^(?:\p{Extended_Pictographic}|\p{Emoji_Presentation}|\u200d|\uFE0F)+$/u.test(semEspacos);
    }

    function deveUsarUserInserindo(campo) {
        var texto = (campo.textContent || '').replace(/\u00A0/g, ' ').trim();
        if (!texto) return false;

        return textoEhLink(texto) || textoEhEmoji(texto);
    }

    function inserirCarimbo(campo) {
        campo.focus();

        // Monta texto do carimbo com data/hora se ativados
        var textoCarimbo = _config.signature;
        var dtParts = [];
        if (_config.showDate || _config.showTime) {
            var agora = new Date();
            if (_config.showDate) {
                var day = String(agora.getDate()).padStart(2, '0');
                var month = String(agora.getMonth() + 1).padStart(2, '0');
                dtParts.push(day + '/' + month + '/' + String(agora.getFullYear()).slice(-2));
            }
            if (_config.showTime) {
                var hours = String(agora.getHours()).padStart(2, '0');
                var minutes = String(agora.getMinutes()).padStart(2, '0');
                dtParts.push(hours + ':' + minutes);
            }
        }
        if (dtParts.length > 0 && textoCarimbo) {
            // Anexa data/hora ao texto puro (em cache) e re-aplica os mesmos marcadores
            var dtSuffix = ' ' + dtParts.join(' ');
            textoCarimbo = reWrapWithMarkers(_assinaturaPura + dtSuffix, textoCarimbo.trim());
        }

        if (deveUsarUserInserindo(campo)) {
            userInserindo(campo, textoCarimbo);
        } else {
            userDigitando(campo, textoCarimbo);
        }
    }
    // Núcleo comum de inserção usado pelas duas estratégias (userDigitando/userInserindo).
    // O atraso é necessário porque o Lexical (React) atualiza seu estado interno de seleção
    // de forma assíncrona, ao ouvir o evento 'selectionchange' do navegador. Sem ele, o
    // comando pode inserir na posição antiga de forma intermitente.
    function inserirTextoNoCampo(campo, textoCarimbo, noInicio) {
        posicionarCursor(campo, noInicio);

        setTimeout(function () {
            if (!document.body.contains(campo)) return;

            // Re-foca e garante o cursor na posição correta caso tenha se perdido
            campo.focus();
            posicionarCursor(campo, noInicio);

            // Com 0 quebras de linha, o espaço é inserido no MESMO comando do carimbo:
            // sem ele, o texto fica colado (ex: "melqui`texto") e a formatação não pega;
            // em um comando separado, o editor pode perder o espaço de forma intermitente
            var quebras = obterQuebras();
            var espacoFinal = quebras === 0 ? ' ' : '';

            document.execCommand('insertText', false, textoCarimbo + espacoFinal);

            for (var i = 0; i < quebras; i++) {
                simularShiftEnter(campo);
            }

            campo.dispatchEvent(new Event('input', { bubbles: true }));

            // Move o cursor para o final do campo após a inserção
            // Isso evita que a primeira letra digitada vá para o final (ex: "elquim" em vez de "melqui")
            setTimeout(function () {
                posicionarCursor(campo, false);
            }, ATRASO_INSERCAO);
        }, ATRASO_INSERCAO);
    }

    function userInserindo(campo, textoCarimbo) {
        inserirTextoNoCampo(campo, textoCarimbo, campoPossuiTexto(campo));
    }

    function userDigitando(campo, textoCarimbo) {
        inserirTextoNoCampo(campo, textoCarimbo, campoPossuiTexto(campo));
    }

    // ====================
    // Normaliza o valor da tecla para comparação consistente
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
        // Se autoSign está ativo, não permite inserção manual via atalho
        if (_config.autoSign) {
            return;
        }

        // Compara o atalho antes de consultar o DOM (a verificação mais barata roda primeiro)
        if (!atalhoCorresponde(evento, _config.shortcut)) {
            return;
        }

        if (!carimboTemConteudo()) {
            return;
        }

        var target = evento.target;
        if (!target || !target.closest) return;

        var campo = target.closest(CAMPO_SELECTOR);
        if (!campo) {
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
    function tentarAutoCarimbar(campo, atraso) {
        if (!_config.autoSign) return;
        if (!carimboTemConteudo()) return;
        if (_camposProcessados.has(campo)) return;
        if (carimboJaExiste(campo)) {
            _camposProcessados.add(campo);
            return;
        }
        // Só insere se o usuário já digitou algo no campo
        if (!campoPossuiTexto(campo)) return;

        _camposProcessados.add(campo);

        // Usamos um delay para lidar com a colagem de links ou inserção de emojis.
        // O WhatsApp (React/Lexical) processa isso de forma assíncrona, e se inserirmos o carimbo
        // imediatamente, o conteúdo colado pode sobrescrever ou empurrar o carimbo.
        setTimeout(function () {
            if (!document.body.contains(campo)) return;

            // O usuário pode ter apagado o texto durante o atraso
            if (!campoPossuiTexto(campo)) {
                _camposProcessados.delete(campo);
                return;
            }

            if (carimboJaExiste(campo)) return;
            inserirCarimbo(campo);
        }, atraso || ATRASO_POS_COLAGEM);
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

        var observer = new MutationObserver(function (mutations) {
            // Debounce: processa em batch via rAF
            if (timeout) return;
            timeout = requestAnimationFrame(function () {
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

        //console.log('[Carimbo] MutationObserver iniciado');
    }

    // ====================
    // Listener de input: detecta quando o usuário digita no campo
    // para disparar o auto-insert (evita inserir ao abrir chat vazio)
    // ====================
    function iniciarInputListener() {
        document.body.addEventListener('input', function (event) {
            var target = event.target;
            if (!target || !target.closest) return;

            var campo = target.closest(CAMPO_SELECTOR);
            if (!campo) return;

            // Colagem/arrastar substituindo o conteúdo pode ter removido o carimbo:
            // libera o campo para ser recarimbado (o evento paste em si é interceptado
            // pelo Lexical e não chega até nós, mas o input gerado por ele chega)
            var ehColagem = event.inputType === 'insertFromPaste' || event.inputType === 'insertFromDrop';
            if (ehColagem) {
                _camposProcessados.delete(campo);
            }

            if (!campoPossuiTexto(campo)) {
                _camposProcessados.delete(campo);
            } else {
                // Digitação é carimbada quase imediatamente; colagem/arrasto e campos
                // com link/emoji mantêm o atraso maior, pois o Lexical precisa processar
                // esse conteúdo antes de o carimbo ser inserido com segurança
                tentarAutoCarimbar(campo, ehColagem || deveUsarUserInserindo(campo) ? ATRASO_POS_COLAGEM : ATRASO_DIGITACAO);
            }
        }, { passive: true });
    }

    // ====================
    // Init
    // ====================
    window.addEventListener('keydown', interceptarAtalho, true);
    iniciarObserver();
    iniciarInputListener();
    //console.log('[Carimbo] Handler injetado e ativo');
})();
