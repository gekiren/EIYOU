# staging チャンネルを AndroidManifest.xml および expo-updates.properties に注入するスクリプト

$updatesPropsPath = "android\app\src\main\assets\expo-updates.properties"
$assetsDir = "android\app\src\main\assets"

if (!(Test-Path $assetsDir)) {
    New-Item -ItemType Directory -Path $assetsDir -Force | Out-Null
}

$updatesConfig = @"
EXPO_SDK_VERSION=51.0.0
EXPO_UPDATES_CHECK_ON_LAUNCH=ALWAYS
EXPO_UPDATES_LAUNCH_WAIT_MS=0
EXPO_UPDATE_URL=https://u.expo.dev/40d3122e-aa40-4c58-a7a2-86e180420480
EXPO_RELEASE_CHANNEL=staging
EXPO_RUNTIME_VERSION=1.0.0
"@

Set-Content -Path $updatesPropsPath -Value $updatesConfig -Encoding UTF8
Write-Host "Injected staging channel into $updatesPropsPath"
