# gta-studio-render

Render dos vídeos HTML do GTA-Studio (canal Igor Alves) em MP4 pelo GitHub Actions. **Repositório privado**: a mídia tem
trechos de trailers e músicas licenciadas, então não pode ficar pública.

## Como renderizar
Actions → **Renderizar vídeo** → *Run workflow* (padrão: `videos/003-habitos-gta6/v3`, mídia `midia-003-v3`, 16 partes).
O MP4 final aparece em **Releases** (`video-<nome>-<n>`).

## Como funciona
1. **planeja**: abre a página no Chrome headless e divide os quadros em N partes, alinhadas aos inícios de cena.
2. **render**: N máquinas em paralelo, cada uma rodando `motor/renderiza.py --_trabalhador` na sua faixa de quadros.
   As partes vão para uma release temporária.
3. **junta**: `motor/render_gh.py junta` concatena as partes, mistura narração + música + efeitos (estéreo) e publica o MP4.

## Vídeo novo
- Código (index.html, *.js) em `videos/<pasta>/`, motor em `motor/` (mesma estrutura do GTA-Studio).
- Mídia pesada: zip com `videos/<pasta>/media/`, `memes/` e os mp3, anexado como `midia.zip` numa release
  (ex.: `gh release create midia-004 midia.zip`), e o nome dela vai no input **midia**.
