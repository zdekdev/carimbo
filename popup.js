// Popup logic - Carimbo Extension (vanilla JS, auto-save)
(function() {
    'use strict';

    let listening = false;
    let saveTimeout = null;

    // Evita salvar estado vazio sobre a config salva antes do loadConfig terminar
    let configCarregada = false;

    // Estado de formatação: persiste independente do texto
    // Array com formatos ativos (ex: [{ marker: '*', fmt: 'bold' }, { marker: '_', fmt: 'italic' }])
    // 'mono' é sempre ativo por padrão (não tem botão na toolbar)
    let currentFormats = [{ marker: '`', fmt: 'mono' }];

    // Ordem de aninhamento dos marcadores (do mais externo para o mais interno)
    const FMT_NESTING_ORDER = ['bold', 'italic', 'strikethrough', 'mono'];
    let autoSignEnabled = true;
    let showDateInSignature = false;
    let showTimeInSignature = false;

    // Atalho atual como objeto com modificadores
    // Formato: { key: 'Tab', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false }
    let currentShortcut = { key: 'Tab', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false };

    // ====================
    // Converte objeto de atalho para string de exibição
    // ====================
    function shortcutToString(shortcut) {
        if (!shortcut || typeof shortcut === 'string') {
            // Compatibilidade com formato antigo (string simples)
            var key = (typeof shortcut === 'string') ? shortcut : (shortcut && shortcut.key);
            if (!key) return 'Tab';
            return key === ' ' ? IDIOMAS[idiomaAtual].teclaEspaco : key;
        }
        var parts = [];
        // Ordem padrão de modificadores: Ctrl, Alt, Shift, Meta
        if (shortcut.ctrlKey || shortcut.metaKey) {
            // No macOS Meta (Cmd) é mais comum, no Windows/Linux Ctrl
            // navigator.platform é deprecado; usa userAgentData quando disponível
            var platform = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '';
            var isMac = platform.toUpperCase().indexOf('MAC') >= 0;
            if (isMac) {
                if (shortcut.metaKey) parts.push('Cmd');
                if (shortcut.ctrlKey) parts.push('Ctrl');
            } else {
                if (shortcut.ctrlKey) parts.push('Ctrl');
                if (shortcut.metaKey) parts.push('Meta');
            }
        }
        if (shortcut.altKey) parts.push('Alt');
        if (shortcut.shiftKey) parts.push('Shift');
        var keyDisplay = shortcut.key;
        if (keyDisplay === ' ') {
            keyDisplay = IDIOMAS[idiomaAtual].teclaEspaco;
        } else if (keyDisplay.length === 1) {
            keyDisplay = keyDisplay.toUpperCase();
        }
        parts.push(keyDisplay);
        return parts.join('+');
    }

    // ====================
    // Normaliza o valor da tecla para comparação consistente
    // ====================
    function normalizeKey(key) {
        if (!key) return '';
        if (key.length === 1) return key.toLowerCase();
        return key;
    }

    // ====================
    // Faz parse do atalho salvo no storage (suporta formato antigo e novo)
    // ====================
    function parseShortcut(value) {
        if (!value) {
            return { key: 'Tab', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false };
        }
        // Novo formato: objeto com key + modificadores
        if (typeof value === 'object' && value.key !== undefined) {
            return {
                key: normalizeKey(value.key),
                ctrlKey: !!value.ctrlKey,
                shiftKey: !!value.shiftKey,
                altKey: !!value.altKey,
                metaKey: !!value.metaKey
            };
        }
        // Formato antigo: string simples (sem modificadores)
        if (typeof value === 'string') {
            return {
                key: normalizeKey(value),
                ctrlKey: false,
                shiftKey: false,
                altKey: false,
                metaKey: false
            };
        }
        return { key: 'Tab', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false };
    }

    // DOM refs
    const signatureInput = document.getElementById('signature');       // visivel - texto puro
    const signatureMdInput = document.getElementById('signature-md');  // oculto - markdown
    const shortcutBtn = document.getElementById('shortcut-btn');
    const shortcutReset = document.getElementById('shortcut-reset');
    const previewChat = document.getElementById('preview-chat');
    const previewInput = document.getElementById('preview-input');
    const charCount = document.getElementById('char-count');
    const fmtButtons = document.querySelectorAll('.fmt-btn[data-fmt]');
    const breakCountInput = document.getElementById('break-count');
    const autoSignCheckbox = document.getElementById('auto-sign');
    const shortcutSection = document.getElementById('shortcut-section');

    // ====================
    // Traduções da interface do popup
    // pt-BR é o idioma padrão; a escolha é salva na chave `language` do storage
    // ====================
    const IDIOMAS = {
        'pt-BR': {
            tituloPagina: 'Configurações - Carimbo',
            labelFormatacao: 'Botões de Formatação',
            labelQuebras: 'Quebras de linha',
            titleQuebras: 'Quebras de linha após o texto',
            titleNegrito: 'Negrito (*texto*)',
            titleItalico: 'Itálico (_texto_)',
            titleTachado: 'Tachado (~texto~)',
            titleData: 'Inserir data atual (dd/mm/aa)',
            titleHora: 'Inserir hora atual (00:00)',
            titleQtyQuebras: 'Quantidade de quebras de linha',
            placeholderAssinatura: 'Digite seu texto (max. 40 caracteres)',
            sufixoCaracteres: '/40 caracteres',
            autoInserirLabel: 'Auto inserir texto como padrão',
            autoInserirHint: 'Insere o texto automaticamente ao abrir um chat. O atalho de teclado será desativado.',
            labelPreviewChat: 'Pré-visualização no chat',
            labelPreviewCampo: 'Pré-visualização no campo de digitação',
            labelAtalho: 'Tecla de Atalho',
            titleRestaurar: 'Restaurar padrão (Tab)',
            hintTeclaPadrao: 'Tecla padrão: Tab',
            hintCliqueTecla: 'Clique no botão acima e pressione a tecla desejada (ex: Tab, Enter, F2, Ctrl+I)',
            rodapeMensagem: 'Abra o WhatsApp Web e use a tecla de atalho configurada para carimbar sua mensagem',
            rodapeAviso: 'Aviso:',
            rodapeAvisoCorpo: 'Esta extensão não tem nenhum vínculo com a Meta ou com o WhatsApp. É gratuita e de código aberto, com compromisso com a privacidade: nenhum dado pessoal é coletado. Visite',
            rodapeAvisoLink: 'o repositório no GitHub',
            rodapeAvisoFim: 'para mais informações.',
            seletorIdiomaTitle: 'Idioma da interface',
            placeholderVazioChat: 'Seu texto aparecerá aqui',
            placeholderVazioCampo: 'Digite uma mensagem',
            simMensagem: 'Bom dia! Segue o relatório solicitado.',
            pressioneTecla: 'Pressione uma tecla...',
            teclaEspaco: 'Espaço'
        },
        'en': {
            tituloPagina: 'Settings - Carimbo',
            labelFormatacao: 'Formatting Buttons',
            labelQuebras: 'Line breaks',
            titleQuebras: 'Line breaks after the text',
            titleNegrito: 'Bold (*text*)',
            titleItalico: 'Italic (_text_)',
            titleTachado: 'Strikethrough (~text~)',
            titleData: 'Insert current date (dd/mm/yy)',
            titleHora: 'Insert current time (00:00)',
            titleQtyQuebras: 'Number of line breaks',
            placeholderAssinatura: 'Type your text (max. 40 characters)',
            sufixoCaracteres: '/40 characters',
            autoInserirLabel: 'Auto-insert text by default',
            autoInserirHint: 'Inserts the text automatically when opening a chat. The keyboard shortcut will be disabled.',
            labelPreviewChat: 'Preview in chat',
            labelPreviewCampo: 'Preview in the typing field',
            labelAtalho: 'Shortcut Key',
            titleRestaurar: 'Restore default (Tab)',
            hintTeclaPadrao: 'Default key: Tab',
            hintCliqueTecla: 'Click the button above and press the desired key (e.g.: Tab, Enter, F2, Ctrl+I)',
            rodapeMensagem: 'Open WhatsApp Web and use the configured shortcut key to stamp your message',
            rodapeAviso: 'Notice:',
            rodapeAvisoCorpo: 'This extension has no affiliation with Meta or WhatsApp. It is free and open source, committed to privacy: no personal data is collected. Visit',
            rodapeAvisoLink: 'the GitHub repository',
            rodapeAvisoFim: 'for more information.',
            seletorIdiomaTitle: 'Interface language',
            placeholderVazioChat: 'Your text will appear here',
            placeholderVazioCampo: 'Type a message',
            simMensagem: 'Good morning! Here is the requested report.',
            pressioneTecla: 'Press a key...',
            teclaEspaco: 'Space'
        },
        'es': {
            tituloPagina: 'Configuración - Carimbo',
            labelFormatacao: 'Botones de formato',
            labelQuebras: 'Saltos de línea',
            titleQuebras: 'Saltos de línea después del texto',
            titleNegrito: 'Negrita (*texto*)',
            titleItalico: 'Cursiva (_texto_)',
            titleTachado: 'Tachado (~texto~)',
            titleData: 'Insertar fecha actual (dd/mm/aa)',
            titleHora: 'Insertar hora actual (00:00)',
            titleQtyQuebras: 'Cantidad de saltos de línea',
            placeholderAssinatura: 'Escribe tu texto (máx. 40 caracteres)',
            sufixoCaracteres: '/40 caracteres',
            autoInserirLabel: 'Insertar texto automáticamente por defecto',
            autoInserirHint: 'Inserta el texto automáticamente al abrir un chat. El atajo de teclado se desactivará.',
            labelPreviewChat: 'Vista previa en el chat',
            labelPreviewCampo: 'Vista previa en el campo de escritura',
            labelAtalho: 'Tecla de atajo',
            titleRestaurar: 'Restaurar predeterminado (Tab)',
            hintTeclaPadrao: 'Tecla predeterminada: Tab',
            hintCliqueTecla: 'Haz clic en el botón de arriba y presiona la tecla deseada (ej: Tab, Enter, F2, Ctrl+I)',
            rodapeMensagem: 'Abre WhatsApp Web y usa la tecla de atajo configurada para sellar tu mensaje',
            rodapeAviso: 'Aviso:',
            rodapeAvisoCorpo: 'Esta extensión no tiene ningún vínculo con Meta ni con WhatsApp. Es gratuita y de código abierto, con compromiso con la privacidad: no se recopilan datos personales. Visita',
            rodapeAvisoLink: 'el repositorio en GitHub',
            rodapeAvisoFim: 'para más información.',
            seletorIdiomaTitle: 'Idioma de la interfaz',
            placeholderVazioChat: 'Tu texto aparecerá aquí',
            placeholderVazioCampo: 'Escribe un mensaje',
            simMensagem: 'Buenos días! Aquí está el informe solicitado.',
            pressioneTecla: 'Presiona una tecla...',
            teclaEspaco: 'Espacio'
        }
    };

    let idiomaAtual = 'pt-BR';

    // ====================
    // Aplica o dicionário do idioma nos textos fixos da interface.
    // Textos movidos para o JS (title da página, pseudo-elementos CSS e preview)
    // também são atualizados aqui
    // ====================
    function aplicarIdioma(lang) {
        if (!IDIOMAS[lang]) {
            lang = 'pt-BR';
        }
        idiomaAtual = lang;

        var dict = IDIOMAS[idiomaAtual];

        document.title = dict.tituloPagina;
        document.documentElement.lang = idiomaAtual;

        var nos = document.querySelectorAll('[data-i18n]');
        for (var i = 0; i < nos.length; i++) {
            var chave = nos[i].getAttribute('data-i18n');
            if (dict[chave] !== undefined) {
                nos[i].textContent = dict[chave];
            }
        }

        var nosTitulo = document.querySelectorAll('[data-i18n-title]');
        for (var j = 0; j < nosTitulo.length; j++) {
            var chaveTitulo = nosTitulo[j].getAttribute('data-i18n-title');
            if (dict[chaveTitulo] !== undefined) {
                nosTitulo[j].setAttribute('title', dict[chaveTitulo]);
            }
        }

        var nosPlaceholder = document.querySelectorAll('[data-i18n-placeholder]');
        for (var k = 0; k < nosPlaceholder.length; k++) {
            var chavePlaceholder = nosPlaceholder[k].getAttribute('data-i18n-placeholder');
            if (dict[chavePlaceholder] !== undefined) {
                nosPlaceholder[k].setAttribute('placeholder', dict[chavePlaceholder]);
            }
        }

        // Textos usados pelos pseudo-elementos :empty::after definidos no CSS
        document.documentElement.style.setProperty('--msg-vazio-chat', dict.placeholderVazioChat);
        document.documentElement.style.setProperty('--msg-vazio-campo', dict.placeholderVazioCampo);

        var seletor = document.getElementById('idioma');
        if (seletor && seletor.value !== idiomaAtual) {
            seletor.value = idiomaAtual;
        }

        // Re-renderiza a pré-visualização com o texto de exemplo no idioma atual
        updatePreview();
    }

    // Marcadores por tipo de formatacao
    const formatDefs = {
        bold:          { marker: '*', fmt: 'bold' },
        italic:        { marker: '_', fmt: 'italic' },
        strikethrough: { marker: '~', fmt: 'strikethrough' },
        mono:          { marker: '`', fmt: 'mono' }
    };

    // ====================
    // Detecta quais formatações estão ativas no texto markdown (recursivo)
    // ====================
    function getFormatsFromMd(text) {
        if (!text) return [];
        var trimmed = text.trim();
        var formats = [];

        for (var i = 0; i < FMT_NESTING_ORDER.length; i++) {
            var fmt = FMT_NESTING_ORDER[i];
            var def = formatDefs[fmt];
            var marker = def.marker;
            if (trimmed.startsWith(marker) && trimmed.endsWith(marker) && trimmed.length >= marker.length * 2 + 1) {
                var inner = trimmed.slice(marker.length, -marker.length);
                if (inner.trim().length > 0) {
                    formats.push(def);
                    // Continua recursivamente no conteudo interno
                    var innerFormats = getFormatsFromMd(inner);
                    for (var j = 0; j < innerFormats.length; j++) {
                        formats.push(innerFormats[j]);
                    }
                    break; // encontrou o marcador mais externo, para aqui
                }
            }
        }
        return formats;
    }

    // ====================
    // Reconstrói o texto markdown combinando formatos + texto puro
    // ====================
    function buildMarkdown(plainText) {
        if (!plainText || !plainText.trim()) return '';
        var result = plainText.trim();
        // Aplica marcadores na ordem de aninhamento (do mais interno para o mais externo)
        for (var i = FMT_NESTING_ORDER.length - 1; i >= 0; i--) {
            var fmt = FMT_NESTING_ORDER[i];
            for (var j = 0; j < currentFormats.length; j++) {
                if (currentFormats[j].fmt === fmt) {
                    var marker = currentFormats[j].marker;
                    result = marker + result + marker;
                    break;
                }
            }
        }
        return result;
    }

    // ====================
    // Remove marcadores markdown -> texto puro
    // ====================
    function stripMarkdown(text) {
        if (!text) return '';
        return text
            .replace(/\*([^*\n]+?)\*/g, '$1')
            .replace(/_([^_\n]+?)_/g, '$1')
            .replace(/~([^~\n]+?)~/g, '$1')
            .replace(/`([^`\n]+?)`/g, '$1');
    }

    // ====================
    // Markdown do WhatsApp -> HTML renderizado
    // ====================
    function renderWppMarkdown(text) {
        if (!text) return '';
        var html = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        html = html.replace(/\*([^*\n]+?)\*/g, '<b>$1</b>');
        html = html.replace(/_([^_\n]+?)_/g, '<i>$1</i>');
        html = html.replace(/~([^~\n]+?)~/g, '<s>$1</s>');
        html = html.replace(/`([^`\n]+?)`/g, '<code>$1</code>');

        return html;
    }

    // ====================
    // Formata data/hora atual
    // ====================
    function getCurrentDate() {
        var now = new Date();
        var day = String(now.getDate()).padStart(2, '0');
        var month = String(now.getMonth() + 1).padStart(2, '0');
        var year = String(now.getFullYear()).slice(-2);
        return day + '/' + month + '/' + year;
    }

    function getCurrentTime() {
        var now = new Date();
        var hours = String(now.getHours()).padStart(2, '0');
        var minutes = String(now.getMinutes()).padStart(2, '0');
        return hours + ':' + minutes;
    }

    // ====================
    // Atualiza estado dos botões de formatação
    // ====================
    function updateFmtButtons() {
        fmtButtons.forEach(function(btn) {
            var fmt = btn.dataset.fmt;
            var active = currentFormats.some(function(f) { return f.fmt === fmt; });
            btn.classList.toggle('active', active);
        });
    }

    function updateDateTimeButtons() {
        var btnDate = document.getElementById('btn-insert-date');
        var btnTime = document.getElementById('btn-insert-time');
        if (btnDate) btnDate.classList.toggle('active', showDateInSignature);
        if (btnTime) btnTime.classList.toggle('active', showTimeInSignature);
    }

    // ====================
    // Ativa/desativa UI do atalho conforme autoSign
    // ====================
    function toggleShortcutUI() {
        if (autoSignCheckbox.checked) {
            shortcutSection.classList.add('shortcut-disabled');
        } else {
            shortcutSection.classList.remove('shortcut-disabled');
        }
    }

    // ====================
    // Atualiza preview (chat bubble + input field)
    // ====================
    function updatePreview() {
        var mdText = signatureMdInput.value;

        // Constroi sufixo de data/hora
        var dtParts = [];
        if (showDateInSignature) {
            dtParts.push(getCurrentDate());
        }
        if (showTimeInSignature) {
            dtParts.push(getCurrentTime());
        }
        var dtSuffix = dtParts.length > 0 ? ' ' + dtParts.join(' ') : '';

        // Monta texto completo (plain + dt) e reconstroi markdown com formatacao
        var plainContent = stripMarkdown(mdText).trim();
        var fullPlain = (plainContent + dtSuffix).trim();
        var fullMd = fullPlain ? buildMarkdown(fullPlain) : '';

        // Chat bubble preview (markdown renderizado)
        var breakCount = parseInt(breakCountInput.value) || 0;
        var breaks = '<br>'.repeat(breakCount);

        // Com 0 quebras, um espaço separa o carimbo da mensagem (igual ao comportamento no chat)
        var sufixoEspaco = breakCount === 0 ? ' ' : '';

        var simulatedMsg = '<div style="border: none;margin-bottom:6px;font-size:13px;color:#111b21;line-height:1.4;word-break:break-word;position:relative">' + IDIOMAS[idiomaAtual].simMensagem + '</div>';
        if (!fullMd) {
            previewChat.innerHTML = simulatedMsg;
        } else {
            previewChat.innerHTML = renderWppMarkdown(fullMd) + sufixoEspaco + breaks + simulatedMsg;
        }

        // Input field preview (texto cru com marcadores markdown visíveis)
        if (!fullMd.trim()) {
            previewInput.textContent = '';
        } else {
            previewInput.textContent = fullMd + sufixoEspaco;
        }
    }

    // ====================
    // Contador de caracteres (baseado no texto visível)
    // ====================
    function updateCharCount() {
        var len = signatureInput.value.length;
        charCount.textContent = len;
        if (len >= 40) {
            charCount.style.color = '#ef4444';
        } else if (len >= 30) {
            charCount.style.color = '#f59e0b';
        } else {
            charCount.style.color = '';
        }
    }

    // ====================
    // Sincroniza o campo oculto a partir do visível + currentFormat
    // ====================
    function syncMdFromVisible() {
        var plain = signatureInput.value;
        signatureMdInput.value = buildMarkdown(plain);
    }

    // ====================
    // Input visível: preserva a formatação, reconstrói o markdown
    // (BUG CORRIGIDO: limpar o texto NÃO remove a formatação)
    // ====================
    signatureInput.addEventListener('input', function() {
        syncMdFromVisible();
        updateFmtButtons();
        updatePreview();
        updateCharCount();
        autoSave();
    });

    // ====================
    // Auto-sign toggle
    // ====================
    autoSignCheckbox.addEventListener('change', function() {
        autoSignEnabled = this.checked;
        toggleShortcutUI();
        forceSaveNow();
    });

    // ====================
    // Botões de formatação (toggle no array de formatos)
    // ====================
    fmtButtons.forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            var fmt = this.dataset.fmt;
            var def = formatDefs[fmt];
            if (!def) return;

            // Verifica se ja esta ativo
            var idx = -1;
            for (var i = 0; i < currentFormats.length; i++) {
                if (currentFormats[i].fmt === fmt) {
                    idx = i;
                    break;
                }
            }

            if (idx !== -1) {
                // Remove do array
                currentFormats.splice(idx, 1);
            } else {
                // Adiciona ao array
                currentFormats.push(def);
            }

            // Reconstrói o campo oculto com os novos formatos
            syncMdFromVisible();

            signatureInput.focus();
            updateFmtButtons();
            updatePreview();
            updateCharCount();
            forceSaveNow();
        });
    });

    // ====================
    // Botões de data e hora (toggles ON/OFF)
    // ====================
    var btnInsertDate = document.getElementById('btn-insert-date');
    var btnInsertTime = document.getElementById('btn-insert-time');
    if (btnInsertDate) {
        btnInsertDate.addEventListener('click', function(e) {
            e.preventDefault();
            showDateInSignature = !showDateInSignature;
            updateDateTimeButtons();
            updatePreview();
            forceSaveNow();
        });
    }
    if (btnInsertTime) {
        btnInsertTime.addEventListener('click', function(e) {
            e.preventDefault();
            showTimeInSignature = !showTimeInSignature;
            updateDateTimeButtons();
            updatePreview();
            forceSaveNow();
        });
    }

    // ====================
    // Force-save: salva imediatamente no storage (sem debounce)
    // Chamado ao fechar o popup (pagehide) e em ações de toggle
    // ====================
    function forceSaveNow() {
        if (!configCarregada) return;

        if (saveTimeout) {
            clearTimeout(saveTimeout);
            saveTimeout = null;
        }

        var breakCount = parseInt(breakCountInput.value, 10);
        // 0 é um valor válido; só aplica o padrão se o valor for inválido
        if (isNaN(breakCount) || breakCount < 0) breakCount = 2;
        if (breakCount > 10) breakCount = 10;

        var formatToSave = currentFormats.map(function(f) { return f.fmt; });

        // Só salva signature-md se houver conteúdo real (sem marcadores)
        var plainContent = stripMarkdown(signatureMdInput.value).trim();
        var sigToSave = plainContent ? signatureMdInput.value : '';

        // Salva o atalho como objeto com modificadores
        var shortcutToSave = {
            key: normalizeKey(currentShortcut.key),
            ctrlKey: !!currentShortcut.ctrlKey,
            shiftKey: !!currentShortcut.shiftKey,
            altKey: !!currentShortcut.altKey,
            metaKey: !!currentShortcut.metaKey
        };

        /*console.log('[Popup] Salvando:', {
            signature: sigToSave,
            signatureFormat: formatToSave,
            shortcut: shortcutToSave,
            breakCount: breakCount,
            autoSign: autoSignEnabled,
            showDate: showDateInSignature,
            showTime: showTimeInSignature
        });*/

        chrome.storage.local.set({
            signature: sigToSave,
            signatureFormat: formatToSave,
            shortcut: shortcutToSave,
            breakCount: breakCount,
            autoSign: autoSignEnabled,
            showDate: showDateInSignature,
            showTime: showTimeInSignature,
            language: idiomaAtual
        }).then(function() {
            //console.log('[Popup] Salvo!');
        }).catch(function(error) {
            console.error('[Popup] Erro ao salvar:', error);
        });
    }

    // ====================
    // Auto-save com debounce (para eventos de digitacao)
    // ====================
    function autoSave() {
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(forceSaveNow, 300);
    }

    // ====================
    // Load config
    // ====================
    function loadConfig() {
        chrome.storage.local.get(['signature', 'signatureFormat', 'shortcut', 'breakCount', 'autoSign', 'showDate', 'showTime', 'language']).then(function(result) {
            // Aplica o idioma escolhido antes de montar a interface
            aplicarIdioma(IDIOMAS[result.language] ? result.language : 'pt-BR');

            //console.log('[Popup] Config recuperada:', result);

            if (result.signature) {
                signatureMdInput.value = result.signature;
                signatureInput.value = stripMarkdown(result.signature);
            }

            // Restaura os formatos salvos
            if (result.signatureFormat) {
                if (Array.isArray(result.signatureFormat)) {
                    // Novo formato: array de nomes
                    currentFormats = [];
                    for (var i = 0; i < result.signatureFormat.length; i++) {
                        var def = formatDefs[result.signatureFormat[i]];
                        if (def) currentFormats.push(def);
                    }
                } else if (typeof result.signatureFormat === 'string' && formatDefs[result.signatureFormat]) {
                    // Compatibilidade com formato antigo (string unica)
                    currentFormats = [formatDefs[result.signatureFormat]];
                }
            } else if (result.signature) {
                // Fallback: detecta formatos a partir do markdown salvo
                currentFormats = getFormatsFromMd(result.signature);
            } else {
                currentFormats = [];
            }

            // Garante que 'mono' esteja sempre presente
            if (!currentFormats.some(function(f) { return f.fmt === 'mono'; })) {
                currentFormats.unshift({ marker: '`', fmt: 'mono' });
            }

            if (result.shortcut) {
                currentShortcut = parseShortcut(result.shortcut);
                shortcutBtn.textContent = shortcutToString(currentShortcut);
            }
            if (result.breakCount !== undefined && result.breakCount !== null) {
                breakCountInput.value = result.breakCount;
            }

            // Restaura autoSign
            if (result.autoSign !== undefined) {
                autoSignEnabled = result.autoSign;
            }
            autoSignCheckbox.checked = autoSignEnabled;
            toggleShortcutUI();

            // Restaura as opções de data/hora
            showDateInSignature = !!result.showDate;
            showTimeInSignature = !!result.showTime;

            updateFmtButtons();
            updateDateTimeButtons();
            updatePreview();
            updateCharCount();
        }).catch(function(error) {
            console.error('[Popup] Erro ao carregar config:', error);
        }).finally(function() {
            configCarregada = true;
        });
    }

    // ====================
    // Break count change -> auto-save
    // ====================
    breakCountInput.addEventListener('input', function() {
        updatePreview();
        autoSave();
    });
    breakCountInput.addEventListener('change', function() {
        updatePreview();
        forceSaveNow();
    });

    // ====================
    // Shortcut key capture (suporta combinações com modificadores)
    // ====================
    shortcutBtn.addEventListener('click', function() {
        if (listening) return;
        listening = true;
        shortcutBtn.classList.add('listening');
        shortcutBtn.textContent = IDIOMAS[idiomaAtual].pressioneTecla;
        //console.log('[Popup] Aguardando tecla (modificadores suportados)...');

        function keyHandler(e) {
            // Ignora pressionamento apenas de teclas modificadoras
            if (['Control', 'Shift', 'Alt', 'Meta', 'CapsLock', 'NumLock', 'ScrollLock'].indexOf(e.key) !== -1) {
                return;
            }

            e.preventDefault();
            e.stopPropagation();

            var capturedShortcut = {
                key: normalizeKey(e.key),
                ctrlKey: e.ctrlKey,
                shiftKey: e.shiftKey,
                altKey: e.altKey,
                metaKey: e.metaKey
            };

            currentShortcut = capturedShortcut;
            var displayKey = shortcutToString(capturedShortcut);
            //console.log('[Popup] Tecla capturada:', JSON.stringify(capturedShortcut), '(exibindo como:', displayKey + ')');

            shortcutBtn.textContent = displayKey;
            shortcutBtn.classList.remove('listening');
            listening = false;
            document.removeEventListener('keydown', keyHandler, true);
            forceSaveNow();
        }

        document.addEventListener('keydown', keyHandler, true);

        setTimeout(function() {
            if (listening) {
                listening = false;
                shortcutBtn.classList.remove('listening');
                shortcutBtn.textContent = shortcutToString(currentShortcut);
                document.removeEventListener('keydown', keyHandler, true);
                //console.log('[Popup] Timeout - nenhuma tecla foi pressionada');
            }
        }, 10000);
    });

    shortcutReset.addEventListener('click', function() {
        currentShortcut = { key: 'Tab', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false };
        shortcutBtn.textContent = 'Tab';
        //console.log('[Popup] Atalho resetado para Tab');
        forceSaveNow();
    });

    // ====================
    // Salva imediatamente ao fechar o popup (antes que setTimeout seja cancelado)
    // ====================
    window.addEventListener('pagehide', function() {
        //console.log('[Popup] Popup fechando - salvando imediatamente...');
        forceSaveNow();
    });

    // ====================
    // Seletor de idioma: aplica e salva a escolha imediatamente
    // ====================
    var idiomaSelect = document.getElementById('idioma');
    if (idiomaSelect) {
        idiomaSelect.addEventListener('change', function() {
            aplicarIdioma(this.value);
            chrome.storage.local.set({ language: idiomaAtual }).catch(function(error) {
                console.error('[Popup] Erro ao salvar idioma:', error);
            });
        });
    }

    // ====================
    // Init
    // ====================
    loadConfig();
    //console.log('[Popup] Pronto - vanilla JS, auto-save ativo');
})();
