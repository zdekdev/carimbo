// Popup logic - WhatsApp Signature Extension (vanilla JS, auto-save)
(function() {
    'use strict';

    let listening = false;
    let saveTimeout = null;

    // Estado de formatacao: persiste independente do texto
    // Array com formatos ativos (ex: [{ marker: '*', fmt: 'bold' }, { marker: '_', fmt: 'italic' }])
    // 'mono' e sempre ativo por padrao (nao tem botao na toolbar)
    let currentFormats = [{ marker: '`', fmt: 'mono' }];

    // Ordem de aninhamento dos marcadores (do mais externo para o mais interno)
    const FMT_NESTING_ORDER = ['bold', 'italic', 'strikethrough', 'mono'];
    let autoSignEnabled = false;
    let showDateInSignature = false;
    let showTimeInSignature = false;

    // Atalho atual como objeto com modificadores
    // Formato: { key: 'Tab', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false }
    let currentShortcut = { key: 'Tab', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false };

    // ====================
    // Converte objeto de atalho para string de exibicao
    // ====================
    function shortcutToString(shortcut) {
        if (!shortcut || typeof shortcut === 'string') {
            // Compatibilidade com formato antigo (string simples)
            var key = (typeof shortcut === 'string') ? shortcut : (shortcut && shortcut.key);
            if (!key) return 'Tab';
            return key === ' ' ? 'Space' : key;
        }
        var parts = [];
        // Ordem padrao de modificadores: Ctrl, Alt, Shift, Meta
        if (shortcut.ctrlKey || shortcut.metaKey) {
            // No macOS Meta (Cmd) e mais comum, no Windows/Linux Ctrl
            var isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
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
            keyDisplay = 'Space';
        } else if (keyDisplay.length === 1) {
            keyDisplay = keyDisplay.toUpperCase();
        }
        parts.push(keyDisplay);
        return parts.join('+');
    }

    // ====================
    // Normaliza o valor da tecla para comparacao consistente
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

    // Marcadores por tipo de formatacao
    const formatDefs = {
        bold:          { marker: '*', fmt: 'bold' },
        italic:        { marker: '_', fmt: 'italic' },
        strikethrough: { marker: '~', fmt: 'strikethrough' },
        mono:          { marker: '`', fmt: 'mono' }
    };

    // ====================
    // Detecta quais formatacoes estao ativas no texto markdown (recursivo)
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
    // Reconstroi o texto markdown combinando formatos + texto puro
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
        var year = now.getFullYear();
        return day + '-' + month + '-' + year;
    }

    function getCurrentTime() {
        var now = new Date();
        var hours = String(now.getHours()).padStart(2, '0');
        var minutes = String(now.getMinutes()).padStart(2, '0');
        return hours + ':' + minutes;
    }

    // ====================
    // Atualiza estado dos botoes de formatacao
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

        // Constroi sufixo de data/hora para preview
        var dtSuffix = '';
        var dtSuffixRaw = '';
        var parts = [];
        if (showDateInSignature) {
            parts.push(getCurrentDate());
        }
        if (showTimeInSignature) {
            parts.push(getCurrentTime());
        }
        if (parts.length > 0) {
            dtSuffix = ' ' + parts.join(' ');
            dtSuffixRaw = ' ' + parts.join(' ');
        }

        // Chat bubble preview (markdown renderizado)
        var plainContent = stripMarkdown(mdText).trim();
        var breakCount = parseInt(breakCountInput.value) || 0;
        var breaks = '<br>'.repeat(breakCount);
        var simulatedMsg = '<div style="border: none;margin-bottom:6px;font-size:13px;color:#111b21;line-height:1.4;word-break:break-word;position:relative">Bom dia! Segue o relatório solicitado.</div>';
        if (!plainContent) {
            previewChat.innerHTML = simulatedMsg;
        } else {
            previewChat.innerHTML = renderWppMarkdown(mdText) + dtSuffix + breaks + simulatedMsg;
        }

        // Input field preview (texto cru com marcadores markdown visiveis)
        var mdRaw = signatureMdInput.value;
        if (!mdRaw.trim()) {
            previewInput.textContent = '';
        } else {
            previewInput.textContent = mdRaw + dtSuffixRaw;
        }
    }

    // ====================
    // Contador de caracteres (baseado no texto visivel)
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
    // Sincroniza o campo oculto a partir do visivel + currentFormat
    // ====================
    function syncMdFromVisible() {
        var plain = signatureInput.value;
        signatureMdInput.value = buildMarkdown(plain);
    }

    // ====================
    // Input visivel: preserva formatacao, rebuilda markdown
    // (BUG CORRIGIDO: limpar texto NAO remove formatacao)
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
        autoSave();
    });

    // ====================
    // Botoes de formatacao (toggle no array de formatos)
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

            // Reconstroi o campo oculto com os novos formatos
            syncMdFromVisible();

            signatureInput.focus();
            updateFmtButtons();
            updatePreview();
            updateCharCount();
            autoSave();
        });
    });

    // ====================
    // Botoes de data e hora (toggles ON/OFF)
    // ====================
    var btnInsertDate = document.getElementById('btn-insert-date');
    var btnInsertTime = document.getElementById('btn-insert-time');
    if (btnInsertDate) {
        btnInsertDate.addEventListener('click', function(e) {
            e.preventDefault();
            showDateInSignature = !showDateInSignature;
            updateDateTimeButtons();
            updatePreview();
            autoSave();
        });
    }
    if (btnInsertTime) {
        btnInsertTime.addEventListener('click', function(e) {
            e.preventDefault();
            showTimeInSignature = !showTimeInSignature;
            updateDateTimeButtons();
            updatePreview();
            autoSave();
        });
    }

    // ====================
    // Auto-save (salva signature-md + formato)
    // ====================
    function autoSave() {
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(function() {
            var breakCount = parseInt(breakCountInput.value, 10) || 2;
            var formatToSave = currentFormats.map(function(f) { return f.fmt; });

            // So salva signature-md se houver conteudo real (sem marcadores)
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

            console.log('[Popup] Auto-salvando:', {
                signature: sigToSave,
                signatureFormat: formatToSave,
                shortcut: shortcutToSave,
                breakCount: breakCount,
                autoSign: autoSignEnabled,
                showDate: showDateInSignature,
                showTime: showTimeInSignature
            });

            chrome.storage.local.set({
                signature: sigToSave,
                signatureFormat: formatToSave,
                shortcut: shortcutToSave,
                breakCount: breakCount,
                autoSign: autoSignEnabled,
                showDate: showDateInSignature,
                showTime: showTimeInSignature
            }).then(function() {
                console.log('[Popup] Salvo!');
            }).catch(function(error) {
                console.error('[Popup] Erro ao salvar:', error);
            });
        }, 500);
    }

    // ====================
    // Load config
    // ====================
    function loadConfig() {
        chrome.storage.local.get(['signature', 'signatureFormat', 'shortcut', 'breakCount', 'autoSign', 'showDate', 'showTime']).then(function(result) {
            console.log('[Popup] Config recuperada:', result);

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

            // Restaura toggles de data/hora
            showDateInSignature = !!result.showDate;
            showTimeInSignature = !!result.showTime;

            updateFmtButtons();
            updateDateTimeButtons();
            updatePreview();
            updateCharCount();
        }).catch(function(error) {
            console.error('[Popup] Erro ao carregar config:', error);
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
        autoSave();
    });

    // ====================
    // Shortcut key capture (suporta combinações com modificadores)
    // ====================
    shortcutBtn.addEventListener('click', function() {
        if (listening) return;
        listening = true;
        shortcutBtn.classList.add('listening');
        shortcutBtn.textContent = 'Pressione uma tecla...';
        console.log('[Popup] Aguardando tecla (modificadores suportados)...');

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
            console.log('[Popup] Tecla capturada:', JSON.stringify(capturedShortcut), '(exibindo como:', displayKey + ')');

            shortcutBtn.textContent = displayKey;
            shortcutBtn.classList.remove('listening');
            listening = false;
            document.removeEventListener('keydown', keyHandler, true);
            autoSave();
        }

        document.addEventListener('keydown', keyHandler, true);

        setTimeout(function() {
            if (listening) {
                listening = false;
                shortcutBtn.classList.remove('listening');
                shortcutBtn.textContent = shortcutToString(currentShortcut);
                document.removeEventListener('keydown', keyHandler, true);
                console.log('[Popup] Timeout - nenhuma tecla foi pressionada');
            }
        }, 10000);
    });

    shortcutReset.addEventListener('click', function() {
        currentShortcut = { key: 'Tab', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false };
        shortcutBtn.textContent = 'Tab';
        console.log('[Popup] Atalho resetado para Tab');
        autoSave();
    });

    // ====================
    // Init
    // ====================
    loadConfig();
    console.log('[Popup] Pronto - vanilla JS, auto-save ativo');
})();
