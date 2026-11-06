# Renderiza partes do vídeo 3D NESTE PC (Windows) e sobe na Release "partes-pc-igor". Uso: powershell -File motor/parte_pc.ps1 18 16
param([Parameter(ValueFromRemainingArguments=$true)][int[]]$Partes)
$ErrorActionPreference = "Stop"
$raiz = Split-Path $PSScriptRoot -Parent
Set-Location $raiz
$env:RENDER_ESTILO = Join-Path $raiz "estilo"
$env:RENDER_SERVIDOR = Join-Path $raiz "motor\servidor_range.py"
if (-not (Test-Path "estilo\video001-3d\index.html")) {
  gh release download midia-elaborando-video001-3d -R igoralvesgta2026/gta-studio-render -p midia3d.zip --clobber
  python -c "import zipfile;zipfile.ZipFile('midia3d.zip').extractall('.')"; Remove-Item midia3d.zip
}
Copy-Item "_clipes_hq\*.mp4" "estilo\video001\clipes\" -Force
python -X utf8 motor\sem_hud.py | Select-Object -Last 1
python -m pip install --quiet playwright
$jobs = foreach ($i in $Partes) {
  $f0 = $i * 879; $f1 = [Math]::Min(17580, ($i + 1) * 879)
  $arq = "parte_{0:D2}_{1}_{2}.mp4" -f $i, $f0, $f1
  Start-Process python -ArgumentList "-X","utf8","motor\renderiza_3d.py","--_trab",$f0,$f1,$arq -NoNewWindow -PassThru
}
$jobs | Wait-Process
gh release view partes-pc-igor -R igoralvesgta2026/gta-studio-render *> $null
if ($LASTEXITCODE -ne 0) { gh release create partes-pc-igor -R igoralvesgta2026/gta-studio-render --prerelease --title "partes pc igor" --notes "partes do render feitas no PC do Igor" }
foreach ($i in $Partes) {
  $f0 = $i * 879; $f1 = [Math]::Min(17580, ($i + 1) * 879); $arq = "parte_{0:D2}_{1}_{2}.mp4" -f $i, $f0, $f1
  if (Test-Path $arq) { gh release upload partes-pc-igor $arq "$arq.sfx.json" -R igoralvesgta2026/gta-studio-render --clobber; "ENVIADA $arq" } else { "FALHOU $arq" }
}
