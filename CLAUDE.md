# Instruções para o Claude neste repositório

## Publicação: sempre direto (pedido do dono em 17/10/2026)
- Depois de terminar e **testar** uma mudança, publique direto, sem perguntar
  "pode mesclar?": commit na branch de trabalho → PR → mesclar no `main`.
- O site é o GitHub Pages do `main` (https://lgrsv.github.io/agenda-iphone/).
  Depois de mesclar, confira que a versão nova está no ar: a primeira linha de
  `sw.js` publicado (`const CACHE = 'agenda-lagares-vNNN-…'`) deve mostrar a
  versão nova. Mudança no app → aumente esse número no `sw.js`.
- Publicar direto não dispensa: testar antes, nunca subir chave, token ou senha
  (o repositório é público) e contar ao dono o que foi publicado, o que foi
  testado e o que não foi.
