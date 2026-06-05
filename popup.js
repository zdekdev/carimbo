// Popup logic - WhatsApp Signature Extension (vanilla JS, auto-save)
(function() {
    'use strict';

    let listening = false;
    let saveTimeout = null;

    // Estado de formatacao: persiste independente do texto
    // null = sem formatacao | { marker: '*', fmt: 'bold' } | etc.
    let currentFormat = null;
    let autoSignEnabled = false;

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
    // Detecta qual formatacao esta ativa no texto markdown
    // ====================
    function getFormatFromMd(text) {
        if (!text) return null;
        var trimmed = text.trim();

        var fmtOrder = ['bold', 'italic', 'strikethrough', 'mono'];
        for (var i = 0; i < fmtOrder.length; i++) {
            var def = formatDefs[fmtOrder[i]];
            var marker = def.marker;
            // So considera formatado se: comeca E termina com o marker, e ha conteudo real entre eles
            if (trimmed.startsWith(marker) && trimmed.endsWith(marker) && trimmed.length >= marker.length * 2 + 1) {
                var inner = trimmed.slice(marker.length, -marker.length);
                if (inner.trim().length > 0) {
                    return def;
                }
            }
        }
        return null;
    }

    // ====================
    // Reconstroi o texto markdown combinando format + texto puro
    // ====================
    function buildMarkdown(plainText) {
        if (!plainText || !plainText.trim()) return '';
        var fmt = currentFormat;
        if (!fmt) return plainText.trim();
        return fmt.marker + plainText.trim() + fmt.marker;
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
    // Atualiza estado dos botoes de formatacao
    // ====================
    function updateFmtButtons() {
        fmtButtons.forEach(function(btn) {
            var fmt = btn.dataset.fmt;
            var active = currentFormat !== null && currentFormat.fmt === fmt;
            btn.classList.toggle('active', active);
        });
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

        // Chat bubble preview (markdown renderizado)
        var plainContent = stripMarkdown(mdText).trim();
        if (!plainContent) {
            previewChat.textContent = '';
        } else {
            previewChat.innerHTML = renderWppMarkdown(mdText);
        }

        // Input field preview (texto puro, sem marcadores)
        var plain = signatureInput.value;
        if (!plain.trim()) {
            previewInput.textContent = '';
        } else {
            previewInput.textContent = plain;
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
    // Botoes de formatacao (toggle no formato, atualiza ambos os campos)
    // ====================
    fmtButtons.forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            var fmt = this.dataset.fmt;
            var def = formatDefs[fmt];
            if (!def) return;

            // Se ja esta com ESTA formatacao ativa -> remove
            if (currentFormat && currentFormat.fmt === fmt) {
                currentFormat = null;
            } else {
                // Aplica nova formatacao (substitui qualquer anterior)
                currentFormat = def;
            }

            // Reconstroi o campo oculto com a nova formatacao
            syncMdFromVisible();

            signatureInput.focus();
            updateFmtButtons();
            updatePreview();
            updateCharCount();
            autoSave();
        });
    });

    // ====================
    // Auto-save (salva signature-md + formato)
    // ====================
    function autoSave() {
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(function() {
            var breakCount = parseInt(breakCountInput.value, 10) || 2;
            var formatToSave = currentFormat ? currentFormat.fmt : null;

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
                autoSign: autoSignEnabled
            });

            chrome.storage.local.set({
                signature: sigToSave,
                signatureFormat: formatToSave,
                shortcut: shortcutToSave,
                breakCount: breakCount,
                autoSign: autoSignEnabled
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
        chrome.storage.local.get(['signature', 'signatureFormat', 'shortcut', 'breakCount', 'autoSign']).then(function(result) {
            console.log('[Popup] Config recuperada:', result);

            if (result.signature) {
                signatureMdInput.value = result.signature;
                signatureInput.value = stripMarkdown(result.signature);
            }

            // Restaura o formato salvo
            if (result.signatureFormat && formatDefs[result.signatureFormat]) {
                currentFormat = formatDefs[result.signatureFormat];
            } else if (result.signature) {
                // Fallback: detecta formato a partir do markdown salvo
                currentFormat = getFormatFromMd(result.signature);
            } else {
                currentFormat = null;
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

            updateFmtButtons();
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
        autoSave();
    });
    breakCountInput.addEventListener('change', function() {
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
