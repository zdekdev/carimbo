# Carimbo

**[Disponível na Chrome Web Store](https://chromewebstore.google.com/detail/kdaeafioggdmhhkefnklmbelebigpcbm?utm_source=item-share-cb)**

Extensão para Chrome/Chromium que adiciona uma assinatura automática ao campo de mensagem do WhatsApp Web.

O projeto foi pensado para equipes pequenas que usam um número compartilhado e precisam identificar rapidamente quem está respondendo cada conversa, sem copiar e colar texto manualmente em todo atendimento.

## Recursos

- Insere assinatura no WhatsApp Web com atalho configurável
- Permite auto-inserção ao abrir um chat
- Suporta negrito, itálico, tachado e mono no padrão de markdown do WhatsApp
- Pode anexar data e hora atuais ao texto
- Permite definir quantidade de quebras de linha após o carimbo
- Mostra pré-visualização do texto no chat e no campo de digitação
- Salva configurações localmente no navegador

## Como funciona

O `Carimbo` injeta um handler na página do WhatsApp Web e aplica a assinatura configurada no popup da extensão. A inserção pode acontecer de duas formas:

- Manualmente, por meio de uma tecla de atalho
- Automaticamente, quando um chat é aberto e a opção de auto-inserção está ativa

## Instalação local

Como o projeto está versionado como código-fonte, a forma mais simples de testar ou usar localmente é carregar a extensão sem compactação no navegador.

### Google Chrome ou Chromium

1. Clone este repositório
2. Acesse `chrome://extensions`
3. Ative o `Modo do desenvolvedor`
4. Clique em `Carregar sem compactação`
5. Selecione a pasta raiz deste repositório

### Microsoft Edge

1. Clone este repositório
2. Acesse `edge://extensions`
3. Ative o `Modo de desenvolvedor`
4. Clique em `Carregar sem compactação`
5. Selecione a pasta raiz deste repositório

## Como usar

1. Instale a extensão localmente no navegador
2. Abra o popup da extensão
3. Defina o texto da assinatura
4. Escolha os formatos desejados
5. Ajuste atalho, data, hora e quantidade de quebras de linha
6. Abra o [WhatsApp Web](https://web.whatsapp.com/)
7. Use o atalho configurado ou habilite a auto-inserção

## Permissões

O projeto usa apenas as permissões necessárias para funcionar:

- `storage`: salva a configuração da assinatura no navegador
- `activeTab`: permite interagir com a aba atual quando necessário
- `scripting`: viabiliza a injeção do handler da extensão
- `https://web.whatsapp.com/*`: restringe a execução ao WhatsApp Web

## Privacidade

- Nenhum backend próprio é utilizado
- As configurações ficam armazenadas localmente no navegador
- O escopo da extensão é limitado ao WhatsApp Web

## Estrutura

- `manifest.json`: manifesto da extensão
- `popup.html`: interface de configuração
- `popup.js`: lógica do popup e persistência das preferências
- `content.js`: ponte entre a extensão e a página
- `page-handler.js`: manipulação do campo de mensagem no WhatsApp Web
- `background.js`: service worker da extensão

## Desenvolvimento

Não há etapa de build no estado atual do projeto. Para desenvolver:

1. Edite os arquivos da extensão
2. Recarregue a extensão na página de extensões do navegador
3. Atualize o WhatsApp Web para validar o comportamento

## Limitações conhecidas

- O comportamento depende da estrutura atual do WhatsApp Web, que pode mudar sem aviso
- A extensão foi pensada para uso em navegadores baseados em Chromium
- Mudanças no editor do WhatsApp podem exigir ajustes nos seletores e eventos usados pela extensão

## Aviso

Este projeto não tem nenhum vínculo com a Meta ou com o WhatsApp. Ele é gratuito e de código aberto, com compromisso com a privacidade: nenhum dado pessoal é coletado.
