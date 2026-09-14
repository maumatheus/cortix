# Sobe o Cortix em produção neste PC e abre um túnel público gratuito da Cloudflare.
# Uso: clique com o botão direito > "Executar com PowerShell" (ou: powershell -ExecutionPolicy Bypass -File scripts\start-public.ps1)
$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
Set-Location (Split-Path $PSScriptRoot -Parent)

# libera a porta 3000
$pids = (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue).OwningProcess | Select-Object -Unique
foreach ($p in $pids) { Stop-Process -Id $p -Force -ErrorAction SilentlyContinue }

if (-not (Test-Path ".next\BUILD_ID")) { Write-Host "Gerando build de produção..."; npm run build }

# túnel (a URL muda a cada execução; para URL fixa crie um túnel nomeado na sua conta Cloudflare)
$log = Join-Path $PWD "storage\tunnel.log"
if (Test-Path $log) { Remove-Item $log -Force }
$tunnel = Start-Process -FilePath "cloudflared" -ArgumentList "tunnel --url http://localhost:3000 --no-autoupdate" -RedirectStandardError $log -PassThru -WindowStyle Hidden
$url = $null
for ($i = 0; $i -lt 30 -and -not $url; $i++) {
  Start-Sleep -Seconds 1
  if (Test-Path $log) { $m = Select-String -Path $log -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' | Select-Object -First 1; if ($m) { $url = $m.Matches[0].Value } }
}
if ($url) {
  $c = [IO.File]::ReadAllText("$PWD\.env"); $c = $c -replace 'APP_URL="[^"]*"', "APP_URL=`"$url`""; [IO.File]::WriteAllText("$PWD\.env", $c, (New-Object System.Text.UTF8Encoding($false)))
  Write-Host ""; Write-Host "===> Cortix público em: $url" -ForegroundColor Green; Write-Host ""
} else { Write-Host "Não consegui obter a URL do túnel (veja storage\tunnel.log)." -ForegroundColor Yellow }

Write-Host "Servidor local: http://localhost:3000  (Ctrl+C encerra)"
try { npm start } finally { if ($tunnel -and -not $tunnel.HasExited) { Stop-Process -Id $tunnel.Id -Force } }
