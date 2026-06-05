// Popup logic - WhatsApp Signature Extension (vanilla JS, auto-save)
(function() {
    'use strict';

    let listening = false;
    let saveTimeout = null;

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
        let html = text
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
    // Detecta formatacao ativa no texto markdown (via regex)
    // ====================
    function detectFormat(text, fmt) {
        if (!text) return false;

        const markers = {
            bold: /\*([^*\n]+?)\*/,
            italic: /_([^_\n]+?)_/,
            strikethrough: /~([^~\n]+?)~/,
            mono: /`([^`\n]+?)`/
        };

        const regex = markers[fmt];
        if (!regex) return false;

        return regex.test(text);
    }

    function updateFmtButtons() {
        const text = signatureMdInput.value.trim();
        fmtButtons.forEach(function(btn) {
            const fmt = btn.dataset.fmt;
            const active = detectFormat(text, fmt);
            btn.classList.toggle('active', active);
        });
    }

    // ====================
    // Atualiza preview (chat bubble + input field)
    // ====================
    function updatePreview() {
        const mdText = signatureMdInput.value;

        // Chat bubble preview (markdown renderizado)
        if (!mdText.trim()) {
            previewChat.textContent = '';
        } else {
            previewChat.innerHTML = renderWppMarkdown(mdText);
        }

        // Input field preview (texto puro, sem marcadores)
        const plain = signatureInput.value;
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
        const len = signatureInput.value.length;
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
    // Botoes de formatacao (toggle no texto OCULTO, atualiza visivel)
    // ====================
    fmtButtons.forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            const fmt = this.dataset.fmt;
            const text = signatureMdInput.value;
            let marker;

            switch (fmt) {
                case 'bold':
                    marker = '*';
                    break;
                case 'italic':
                    marker = '_';
                    break;
                case 'strikethrough':
                    marker = '~';
                    break;
                case 'mono':
                    marker = '`';
                    break;
                default:
                    return;
            }

            const trimmed = text.trim();

            // Verifica se o texto INTEIRO ja esta envolvido pelo marcador
            const isWrapped = trimmed.startsWith(marker) && trimmed.endsWith(marker);

            if (isWrapped) {
                signatureMdInput.value = trimmed.slice(marker.length, -marker.length);
            } else {
                signatureMdInput.value = marker + trimmed + marker;
            }

            // Atualiza o input visivel removendo os marcadores
            signatureInput.value = stripMarkdown(signatureMdInput.value);

            signatureInput.focus();
            updateFmtButtons();
            updatePreview();
            updateCharCount();
            autoSave();
        });
    });

    // ====================
    // Auto-save
    // ====================
    function autoSave() {
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(async function() {
            let shortcutParaSalvar = shortcutBtn.textContent;
            if (shortcutParaSalvar === 'Space') {
                shortcutParaSalvar = ' ';
            }

            const breakCount = parseInt(breakCountInput.value, 10) || 2;

            console.log('[Popup] Auto-salvando:', {
                signature: signatureMdInput.value,
                shortcut: shortcutParaSalvar,
                breakCount: breakCount
            });

            try {
                await chrome.storage.local.set({
                    signature: signatureMdInput.value,
                    shortcut: shortcutParaSalvar,
                    breakCount: breakCount
                });
                console.log('[Popup] Salvo!');
            } catch (error) {
                console.error('[Popup] Erro ao salvar:', error);
            }
        }, 500);
    }

    // ====================
    // Input visivel: sincroniza com oculto, atualiza preview + char count + auto-save
    // ====================
    signatureInput.addEventListener('input', function() {
        // Sincroniza o oculto com o texto visivel (markdown e perdido ao digitar manualmente)
        signatureMdInput.value = signatureInput.value;
        updateFmtButtons();
        updatePreview();
        updateCharCount();
        autoSave();
    });

    // Break count change -> auto-save
    breakCountInput.addEventListener('input', function() {
        autoSave();
    });
    breakCountInput.addEventListener('change', function() {
        autoSave();
    });

    // ====================
    // Load config
    // ====================
    async function loadConfig() {
        try {
            console.log('[Popup] Carregando config do storage...');
            const result = await chrome.storage.local.get(['signature', 'shortcut', 'breakCount']);
            console.log('[Popup] Config recuperada:', result);

            if (result.signature) {
                // O storage contem markdown -> vai para o campo oculto
                signatureMdInput.value = result.signature;
                // Campo visivel mostra apenas texto puro
                signatureInput.value = stripMarkdown(result.signature);
            }
            if (result.shortcut) {
                shortcutBtn.textContent = result.shortcut === ' ' ? 'Space' : result.shortcut;
            }
            if (result.breakCount !== undefined && result.breakCount !== null) {
                breakCountInput.value = result.breakCount;
            }
            updateFmtButtons();
            updatePreview();
            updateCharCount();
        } catch (error) {
            console.error('[Popup] Erro ao carregar config:', error);
        }
    }

    // ====================
    // Shortcut key capture
    // ====================
    shortcutBtn.addEventListener('click', function() {
        if (listening) return;
        listening = true;
        shortcutBtn.classList.add('listening');
        shortcutBtn.textContent = 'Pressione uma tecla...';
        console.log('[Popup] Aguardando tecla...');

        function keyHandler(e) {
            e.preventDefault();
            e.stopPropagation();

            const key = e.key;
            const displayKey = key === ' ' ? 'Space' : key;
            console.log('[Popup] Tecla capturada:', key, '(exibindo como:', displayKey + ')');

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
                shortcutBtn.textContent = 'Tab';
                document.removeEventListener('keydown', keyHandler, true);
                console.log('[Popup] Timeout - nenhuma tecla foi pressionada');
            }
        }, 10000);
    });

    shortcutReset.addEventListener('click', function() {
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
