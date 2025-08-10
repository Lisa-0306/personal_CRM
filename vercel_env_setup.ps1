# Configure Vercel environment variables for SMS (Tencent Cloud) and enable OTP sending
# Usage example:
#   .\vercel_env_setup.ps1 -VercelToken "VERCEL_TOKEN" -Project "your-project-name" -TeamId "team_xxx" \
#       -TENCENT_SECRET_ID "xxx" -TENCENT_SECRET_KEY "yyy" -SMS_SDK_APP_ID "1400xxxxx" \
#       -SMS_TEMPLATE_ID "1234567" -SMS_SIGN_NAME "你的签名" -SMS_REGION "ap-guangzhou"

param(
  [Parameter(Mandatory=$true)] [string]$VercelToken,
  [Parameter(Mandatory=$true)] [string]$Project,      # Project ID or Name
  [Parameter(Mandatory=$false)] [string]$TeamId = "",

  [Parameter(Mandatory=$false)] [string]$ENABLE_SMS = "1",
  [Parameter(Mandatory=$true)] [string]$TENCENT_SECRET_ID,
  [Parameter(Mandatory=$true)] [string]$TENCENT_SECRET_KEY,
  [Parameter(Mandatory=$true)] [string]$SMS_SDK_APP_ID,
  [Parameter(Mandatory=$true)] [string]$SMS_TEMPLATE_ID,
  [Parameter(Mandatory=$true)] [string]$SMS_SIGN_NAME,
  [Parameter(Mandatory=$false)] [string]$SMS_REGION = "ap-guangzhou",
  [Parameter(Mandatory=$false)] [bool]$IncludePreview = $true
)

function Invoke-VercelApi {
  param(
    [Parameter(Mandatory=$true)] [ValidateSet('GET','POST','DELETE')] [string]$Method,
    [Parameter(Mandatory=$true)] [string]$Path,
    [Parameter(Mandatory=$false)] $Body
  )
  $base = "https://api.vercel.com"
  $url = "$base$Path"
  if ($TeamId -and $TeamId -ne "") { $url = "$url?teamId=$TeamId" }

  $headers = @{ Authorization = "Bearer $VercelToken" }
  if ($Method -eq 'GET') {
    return Invoke-RestMethod -Uri $url -Headers $headers -Method Get -ErrorAction Stop
  }
  elseif ($Method -eq 'POST') {
    $json = ($Body | ConvertTo-Json -Depth 5)
    return Invoke-RestMethod -Uri $url -Headers $headers -Method Post -Body $json -ContentType 'application/json' -ErrorAction Stop
  }
  elseif ($Method -eq 'DELETE') {
    return Invoke-RestMethod -Uri $url -Headers $headers -Method Delete -ErrorAction Stop
  }
}

function Get-ExistingEnvMap {
  $res = Invoke-VercelApi -Method GET -Path "/v9/projects/$Project/env"
  # Return a map: key -> list of env entries
  $map = @{}
  foreach ($e in $res.envs) {
    if (-not $map.ContainsKey($e.key)) { $map[$e.key] = @() }
    $map[$e.key] += $e
  }
  return $map
}

function Remove-EnvByKeyAndTarget {
  param(
    [Parameter(Mandatory=$true)] [string]$Key,
    [Parameter(Mandatory=$true)] [string]$Target,
    [Parameter(Mandatory=$true)] $ExistingMap
  )
  if ($ExistingMap.ContainsKey($Key)) {
    foreach ($e in $ExistingMap[$Key]) {
      if ($e.target -contains $Target) {
        Invoke-VercelApi -Method DELETE -Path "/v9/projects/$Project/env/$($e.id)" | Out-Null
      }
    }
  }
}

function Create-Env {
  param(
    [Parameter(Mandatory=$true)] [string]$Key,
    [Parameter(Mandatory=$true)] [string]$Value,
    [Parameter(Mandatory=$true)] [string[]]$Targets
  )
  $body = @{ key = $Key; value = $Value; target = $Targets; type = 'plain' }
  Invoke-VercelApi -Method POST -Path "/v10/projects/$Project/env" -Body $body | Out-Null
}

Write-Host "🔧 准备配置 Vercel 环境变量 (Project=$Project, TeamId=$TeamId)" -ForegroundColor Cyan
$existing = Get-ExistingEnvMap

$targets = @('production')
if ($IncludePreview) { $targets += 'preview' }

function Upsert-Key {
  param([string]$Key, [string]$Value)
  foreach ($t in $targets) { Remove-EnvByKeyAndTarget -Key $Key -Target $t -ExistingMap $existing }
  Create-Env -Key $Key -Value $Value -Targets $targets
  Write-Host "✔ 已设置 $Key -> [$($targets -join ', ')]" -ForegroundColor Green
}

Upsert-Key -Key 'ENABLE_SMS' -Value $ENABLE_SMS
Upsert-Key -Key 'TENCENT_SECRET_ID' -Value $TENCENT_SECRET_ID
Upsert-Key -Key 'TENCENT_SECRET_KEY' -Value $TENCENT_SECRET_KEY
Upsert-Key -Key 'SMS_SDK_APP_ID' -Value $SMS_SDK_APP_ID
Upsert-Key -Key 'SMS_TEMPLATE_ID' -Value $SMS_TEMPLATE_ID
Upsert-Key -Key 'SMS_SIGN_NAME' -Value $SMS_SIGN_NAME
Upsert-Key -Key 'SMS_REGION' -Value $SMS_REGION

Write-Host "🎉 完成。请在 Vercel 控制台查看 Environment Variables，并触发一次重新部署。" -ForegroundColor Yellow


