// ==UserScript==
// @name         Assinatura Automática - WhatsApp Web
// @namespace    https://github.com/usuario/assinatura-whatsapp
// @version      1.7
// @description  Insere sua assinatura ao pressionar Tab no WhatsApp Web
// @author       Você
// @match        https://web.whatsapp.com/*
// @icon         https://web.whatsapp.com/favicon.ico
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    const MINHA_ASSINATURA = "`>[ Melquizedeque ]:`";

    function encontrarPrimeiroNoTexto(elemento) {
        // Percorre a arvore DOM para encontrar o primeiro no de texto com conteudo
        const walker = document.createTreeWalker(
            elemento,
            NodeFilter.SHOW_TEXT,
            null
        );
        let node = walker.firstChild();
        // Pula nos de texto vazios (apenas whitespace entre elementos)
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
            // Tenta achar o primeiro no de texto real dentro do editor (Lexical)
            const primeiroNo = encontrarPrimeiroNoTexto(elemento);
            if (primeiroNo) {
                range.setStart(primeiroNo, 0);
                range.collapse(true);
            } else {
                // Fallback: se nao houver texto, usa o inicio do elemento
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
        // Verifica se ha texto visivel (ignora espacos em branco e quebras de linha)
        const texto = elemento.textContent || '';
        return texto.trim().length > 0;
    }

    function assinaturaJaExiste(elemento) {
        const texto = elemento.textContent || '';
        return texto.includes(MINHA_ASSINATURA);
    }

    function simularShiftEnter(elemento) {
        // O Lexical (e a maioria dos editores complexos) precisa do ciclo completo
        // de keydown -> keyup para registrar a tecla corretamente.
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

        if (evento.key !== 'Tab') {
            return;
        }

        evento.preventDefault();
        evento.stopImmediatePropagation();

        // Se a assinatura ja estiver no campo, nao insere novamente
        if (assinaturaJaExiste(campo)) {
            return;
        }

        campo.focus();

        const temTexto = campoPossuiTexto(campo);

        if (temTexto) {
            // Se ja tem texto, insere a assinatura no topo (inicio)
            posicionarCursor(campo, true);
            document.execCommand('insertText', false, MINHA_ASSINATURA);
            simularShiftEnter(campo);
            simularShiftEnter(campo);
        } else {
            // Campo vazio: insere no final como antes
            posicionarCursor(campo, false);
            document.execCommand('insertText', false, MINHA_ASSINATURA);
            simularShiftEnter(campo);
            simularShiftEnter(campo);
        }

        campo.dispatchEvent(new Event('input', { bubbles: true }));
    }

    window.addEventListener('keydown', interceptarAtalho, true);
})();