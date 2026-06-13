# Carimbo

Extensao para Chrome/Chromium que adiciona uma assinatura automatica ao campo de mensagem do WhatsApp Web.

O projeto foi pensado para equipes pequenas que usam um numero compartilhado e precisam identificar rapidamente quem esta respondendo cada conversa, sem copiar e colar texto manualmente em todo atendimento.

## Recursos

- Insere assinatura no WhatsApp Web com atalho configuravel
- Permite auto-insercao ao abrir um chat
- Suporta negrito, italico, tachado e mono no padrao de markdown do WhatsApp
- Pode anexar data e hora atuais ao texto
- Permite definir quantidade de quebras de linha apos o carimbo
- Mostra pre-visualizacao do texto no chat e no campo de digitacao
- Salva configuracoes localmente no navegador

## Como funciona

O `Carimbo` injeta um handler na pagina do WhatsApp Web e aplica a assinatura configurada no popup da extensao. A insercao pode acontecer de duas formas:

- Manualmente, por meio de uma tecla de atalho
- Automaticamente, quando um chat e aberto e a opcao de auto-insercao esta ativa

## Instalacao local

Como o projeto esta versionado como codigo-fonte, a forma mais simples de testar ou usar localmente e carregar a extensao sem compactacao no navegador.

### Google Chrome ou Chromium

1. Clone este repositorio
2. Acesse `chrome://extensions`
3. Ative o `Modo do desenvolvedor`
4. Clique em `Carregar sem compactacao`
5. Selecione a pasta raiz deste repositorio

### Microsoft Edge

1. Clone este repositorio
2. Acesse `edge://extensions`
3. Ative o `Modo de desenvolvedor`
4. Clique em `Carregar sem compactacao`
5. Selecione a pasta raiz deste repositorio

## Como usar

1. Instale a extensao localmente no navegador
2. Abra o popup da extensao
3. Defina o texto da assinatura
4. Escolha os formatos desejados
5. Ajuste atalho, data, hora e quantidade de quebras de linha
6. Abra o [WhatsApp Web](https://web.whatsapp.com/)
7. Use o atalho configurado ou habilite a auto-insercao

## Permissoes

O projeto usa apenas as permissoes necessarias para funcionar:

- `storage`: salva a configuracao da assinatura no navegador
- `activeTab`: permite interagir com a aba atual quando necessario
- `scripting`: viabiliza a injecao do handler da extensao
- `https://web.whatsapp.com/*`: restringe a execucao ao WhatsApp Web

## Privacidade

- Nenhum backend proprio e utilizado
- As configuracoes ficam armazenadas localmente no navegador
- O escopo da extensao e limitado ao WhatsApp Web

## Estrutura

- `manifest.json`: manifesto da extensao
- `popup.html`: interface de configuracao
- `popup.js`: logica do popup e persistencia das preferencias
- `content.js`: ponte entre a extensao e a pagina
- `page-handler.js`: manipulacao do campo de mensagem no WhatsApp Web
- `background.js`: service worker da extensao

## Desenvolvimento

Nao ha etapa de build no estado atual do projeto. Para desenvolver:

1. Edite os arquivos da extensao
2. Recarregue a extensao na pagina de extensoes do navegador
3. Atualize o WhatsApp Web para validar o comportamento

## Limitacoes conhecidas

- O comportamento depende da estrutura atual do WhatsApp Web, que pode mudar sem aviso
- A extensao foi pensada para uso em navegadores baseados em Chromium
- Mudancas no editor do WhatsApp podem exigir ajustes nos seletores e eventos usados pela extensao

## Aviso

Este projeto nao possui afiliacao oficial com a Meta ou com o WhatsApp.
