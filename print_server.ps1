$port = 8080
$url = "http://+:$port/"

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($url)

try {
    $listener.Start()
    Write-Host "=====================================================" -ForegroundColor Cyan
    Write-Host " b-PAC Print Server Started successfully!" -ForegroundColor Green
    Write-Host " Listening for requests on port $port..."
    Write-Host " "
    Write-Host " [IMPORTANT] Please open the following URL on your smartphone:" -ForegroundColor Yellow
    Write-Host " http://192.168.3.19:8080/" -ForegroundColor White
    Write-Host " "
    Write-Host " Keep this window open. Press Ctrl+C to stop."
    Write-Host "=====================================================`n" -ForegroundColor Cyan
}
catch {
    Write-Host "Error: Failed to start listener." -ForegroundColor Red
    Write-Host $_.Exception.Message
    Write-Host "`nRun PowerShell as Administrator and execute this command to allow the port:" -ForegroundColor Yellow
    Write-Host "netsh http add urlacl url=http://+:8080/ user=Everyone`n"
    Pause
    exit
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $response.Headers.Add("Access-Control-Allow-Origin", "*")
        $response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        $response.Headers.Add("Access-Control-Allow-Headers", "Content-Type")

        if ($request.HttpMethod -eq "OPTIONS") {
            $response.StatusCode = 200
            $response.Close()
            continue
        }

        # index.html をスマホに直接配信する機能を追加
        if ($request.HttpMethod -eq "GET") {
            $indexPath = Join-Path $scriptDir "index.html"
            if (Test-Path $indexPath) {
                $htmlBytes = [System.IO.File]::ReadAllBytes($indexPath)
                $response.ContentType = "text/html; charset=utf-8"
                $response.OutputStream.Write($htmlBytes, 0, $htmlBytes.Length)
            }
            else {
                $response.StatusCode = 404
            }
            $response.Close()
            continue
        }

        if ($request.HttpMethod -eq "POST") {
            $reader = New-Object System.IO.StreamReader($request.InputStream)
            $body = $reader.ReadToEnd()
            $data = $body | ConvertFrom-Json

            $sn = $data.sn
            $lot = $data.lotSeqNumber # 追加: ログで確認するため
            Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Print request received: SN=$sn, Lot=$lot"

            try {
                $bpac = New-Object -ComObject "bpac.Document"
                $isOpen = $bpac.Open("C:\KiriPlayPark\PcRepairLabel.lbx")
                
                if ($isOpen) {
                    $bpac.GetObject("txtLot").Text = $data.lotSeqNumber
                    
                    # QRコードへのデータセット（確実なバーコード用APIを使用）
                    $idx = $bpac.GetBarcodeIndex("qrLot")
                    if ($idx -ne -1) {
                        $bpac.SetBarcodeData($idx, $data.lotSeqNumber) | Out-Null
                        Write-Host "  -> QR Code (qrLot) updated with: $($data.lotSeqNumber)" -ForegroundColor Cyan
                    } else {
                        Write-Host "  -> WARNING: Object 'qrLot' NOT FOUND in PcRepairLabel.lbx" -ForegroundColor Yellow
                    }

                    $bpac.GetObject("txtSN").Text = $data.sn
                    $bpac.GetObject("txtID").Text = $data.deviceId
                    $bpac.GetObject("txtSymptom").Text = $data.symptom
                    
                    # ↓ P-touch Editorを使わずに、直接プリンターを指定します
                    $bpac.SetPrinter("Brother QL-820NWB (2 コピー)", $false) | Out-Null
                    
                    $bpac.StartPrint("", 0) | Out-Null
                    $bpac.PrintOut(1, 0) | Out-Null
                    $bpac.EndPrint() | Out-Null
                    $bpac.Close() | Out-Null
                    
                    $resString = '{"status":"success"}'
                    Write-Host "  -> Print SUCCESS" -ForegroundColor Green
                } else {
                    $resString = '{"status":"error", "message":"Could not open PcRepairLabel.lbx"}'
                    Write-Host "  -> Error: Cannot open lbx file" -ForegroundColor Red
                }
            } catch {
                $errMsg = $_.Exception.Message -replace '"', '\"'
                $resString = '{"status":"error", "message":"' + $errMsg + '"}'
                Write-Host "  -> Error: $errMsg" -ForegroundColor Red
            }

            $resBytes = [System.Text.Encoding]::UTF8.GetBytes($resString)
            $response.ContentType = "application/json"
            $response.OutputStream.Write($resBytes, 0, $resBytes.Length)
            $response.Close()
        } else {
            $response.StatusCode = 405
            $response.Close()
        }
    } catch {
        Write-Host "Connection error: $_" -ForegroundColor Red
    }
}
