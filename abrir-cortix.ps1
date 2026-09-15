# Abre o Cortix em desenvolvimento: sobe o servidor se ele nao estiver no ar e abre o navegador.
# Usado pelo atalho "Cortix" da Area de Trabalho. Porta 3001 (a 3000 fica com outro projeto).
# Para publicar com URL publica, use scripts\start-public.ps1 (producao + tunel, porta 3000).

$ErrorActionPreference = 'Stop'
$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')

$projeto = Split-Path -Parent $MyInvocation.MyCommand.Path
$porta   = 3001
$url     = "http://localhost:$porta"
$log     = Join-Path $projeto 'storage\dev-server.log'

function Responde {
    try {
        $r = Invoke-WebRequest -Uri "$url/login" -TimeoutSec 3 -UseBasicParsing
        return ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500)
    } catch { return $false }
}

Write-Host ''
Write-Host '  Cortix' -ForegroundColor Magenta
Write-Host "  $projeto" -ForegroundColor DarkGray
Write-Host ''

if (Responde) {
    Write-Host "  Servidor ja estava no ar em $url" -ForegroundColor Green
} else {
    $ocupada = Get-NetTCPConnection -LocalPort $porta -State Listen -ErrorAction SilentlyContinue
    if ($ocupada) {
        Write-Host "  A porta $porta esta ocupada por outro processo (PID $($ocupada.OwningProcess -join ', '))." -ForegroundColor Yellow
        Write-Host '  Feche esse processo, ou troque a porta no package.json e no .env.' -ForegroundColor Yellow
        Read-Host '  Enter para sair'
        exit 1
    }

    Write-Host '  Subindo o servidor, aguarde...' -ForegroundColor Cyan
    $pasta = Split-Path -Parent $log
    if (-not (Test-Path $pasta)) { New-Item -ItemType Directory -Path $pasta -Force | Out-Null }

    Start-Process -FilePath 'cmd.exe' `
        -ArgumentList '/c', "npm run dev > `"$log`" 2>&1" `
        -WorkingDirectory $projeto `
        -WindowStyle Minimized

    $pronto = $false
    foreach ($i in 1..90) {
        Start-Sleep -Seconds 1
        if (Responde) { $pronto = $true; break }
    }

    if ($pronto) {
        Write-Host "  Pronto em $url" -ForegroundColor Green
    } else {
        Write-Host '  O servidor nao respondeu em 90 segundos. Ultimas linhas do log:' -ForegroundColor Red
        if (Test-Path $log) { Get-Content $log -Tail 15 | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray } }
        Read-Host '  Enter para sair'
        exit 1
    }
}

Start-Process $url
Write-Host '  Navegador aberto. O servidor continua rodando na janela minimizada.' -ForegroundColor DarkGray
Start-Sleep -Seconds 3
