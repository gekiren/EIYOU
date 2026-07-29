# EAS Update (staging) 設定注入スクリプト
$propFile = "android\app\src\main\assets\expo-updates.properties"

$content = @"
EXPO_SDK_VERSION=52.0.0
EXPO_UPDATES_CHECK_ON_LAUNCH=ALWAYS
EXPO_UPDATES_LAUNCH_WAIT_MS=3000
EXPO_UPDATE_URL=https://u.expo.dev/40d3122e-aa40-4c58-a7a2-86e180420480
EXPO_CHANNEL_NAME=staging
EXPO_RELEASE_CHANNEL=staging
EXPO_RUNTIME_VERSION=1.0.0
"@

Set-Content -Path $propFile -Value $content -Encoding UTF8
Write-Host "Injected staging channel and 3000ms launch wait into $propFile"
