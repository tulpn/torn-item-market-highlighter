<#
.SYNOPSIS
  Fetches shop sell prices from the Torn API once and bakes them into the userscript.

.USAGE
  .\build-prices.ps1 -ApiKey YOUR_KEY
  (a key with "Public" access is enough)
#>
param(
  [Parameter(Mandatory = $true)] [string] $ApiKey,
  [string] $ScriptPath = (Join-Path $PSScriptRoot 'torn-market-shop-price-highlighter.user.js')
)

$ErrorActionPreference = 'Stop'

$url = "https://api.torn.com/torn/?selections=items&key=$ApiKey"
$data = Invoke-RestMethod -Uri $url
if ($data.error) { throw "Torn API error $($data.error.code): $($data.error.error)" }

# Build { id: sellPrice } for every item a shop will buy, sorted by numeric id.
$pairs = foreach ($p in $data.items.PSObject.Properties) {
  $sell = [int]$p.Value.sell_price
  if ($sell -gt 0) { [pscustomobject]@{ Id = [int]$p.Name; Sell = $sell } }
}
$pairs = $pairs | Sort-Object Id
$json = '{' + (($pairs | ForEach-Object { "`"$($_.Id)`":$($_.Sell)" }) -join ',') + '}'

$src = Get-Content -Raw -Path $ScriptPath
$pattern = '(?s)(// @@SHOP_PRICES_START\r?\n).*?(\r?\n\s*// @@SHOP_PRICES_END)'
if ($src -notmatch $pattern) { throw "Markers not found in $ScriptPath" }

$stamp = Get-Date -Format 'yyyy-MM-dd'
$block = "  // generated $stamp - $($pairs.Count) items`n  const SHOP_PRICES_GENERATED = '$stamp';`n  const SHOP_SELL_PRICES = $json;"
$out = [regex]::Replace($src, $pattern, { param($m) $m.Groups[1].Value + $block + $m.Groups[2].Value })

Set-Content -Path $ScriptPath -Value $out -NoNewline -Encoding utf8
Write-Host "Embedded $($pairs.Count) shop sell prices into $ScriptPath"
