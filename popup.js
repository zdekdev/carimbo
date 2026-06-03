// Popup logic - WhatsApp Signature Extension (vanilla JS, auto-save)
(function() {
    'use strict';

    let listening = false;
    let saveTimeout = null;
    let indicatorTimeout = null;

    // DOM refs
    const signatureInput = document.getElementById('signature');
    const shortcutBtn = document.getElementById('shortcut-btn');
    const shortcutReset = document.getElementById('shortcut-reset');
    const previewEl = document.getElementById('preview');
    const saveIndicator = document.getElementById('save-indicator');
    const fmtButtons = document.querySelectorAll('.fmt-btn[data-fmt]');
    const breakCountInput = document.getElementById('break-count');

    // ====================
    // Markdown do WhatsApp -> HTML renderizado
    // ====================
    function renderWppMarkdown(text) {
        if (!text) return '';
        let html = '';

        // Escapa HTML primeiro
        html = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // Bold: *texto*  (nao pode cruzar linhas, nem estar vazio)
        html = html.replace(/\*([^*\n]+?)\*/g, '<b>$1</b>');

        // Italic: _texto_
        html = html.replace(/_([^_\n]+?)_/g, '<i>$1</i>');

        // Strikethrough: ~texto~
        html = html.replace(/~([^~\n]+?)~/g, '<s>$1</s>');

        // Monospace: `texto`
        html = html.replace(/`([^`\n]+?)`/g, '<code>$1</code>');

        return html;
    }

    // Atualiza o preview renderizado
    function updatePreview() {
        const raw = signatureInput.value;
        if (!raw.trim()) {
            previewEl.textContent = '[ Nenhuma assinatura configurada ]';
            return;
        }
        previewEl.innerHTML = renderWppMarkdown(raw);
    }

    // ====================
    // Botões de formatação (toggle no texto inteiro)
    // ====================
    fmtButtons.forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            const fmt = this.dataset.fmt;
            const textarea = signatureInput;
            const text = textarea.value;
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
                textarea.value = trimmed.slice(marker.length, -marker.length);
            } else {
                textarea.value = marker + trimmed + marker;
            }

            textarea.focus();
            updatePreview();
            autoSave();
        });
    });

    // ====================
    // Auto-save
    // ====================
    function showSaved() {
        saveIndicator.classList.add('visible');
        if (indicatorTimeout) clearTimeout(indicatorTimeout);
        indicatorTimeout = setTimeout(function() {
            saveIndicator.classList.remove('visible');
        }, 2000);
    }

    function autoSave() {
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(async function() {
            let shortcutParaSalvar = shortcutBtn.textContent;
            if (shortcutParaSalvar === 'Space') {
                shortcutParaSalvar = ' ';
            }

            const breakCount = parseInt(breakCountInput.value, 10) || 2;

            console.log('[Popup] Auto-salvando:', {
                signature: signatureInput.value,
                shortcut: shortcutParaSalvar,
                breakCount: breakCount
            });

            try {
                await chrome.storage.local.set({
                    signature: signatureInput.value,
                    shortcut: shortcutParaSalvar,
                    breakCount: breakCount
                });
                console.log('[Popup] Salvo!');
                showSaved();
            } catch (error) {
                console.error('[Popup] Erro ao salvar:', error);
            }
        }, 500);
    }

    // ====================
    // Input: atualiza preview + auto-save
    // ====================
    signatureInput.addEventListener('input', function() {
        updatePreview();
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
                signatureInput.value = result.signature;
            }
            if (result.shortcut) {
                shortcutBtn.textContent = result.shortcut === ' ' ? 'Space' : result.shortcut;
            }
            if (result.breakCount !== undefined && result.breakCount !== null) {
                breakCountInput.value = result.breakCount;
            }
            updatePreview();
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
