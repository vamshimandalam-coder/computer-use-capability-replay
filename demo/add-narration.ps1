$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$videoDirectory = Join-Path $projectRoot 'evidence\video'
$sourceVideo = Join-Path $videoDirectory 'computer-use-demo.webm'
$narrationFile = Join-Path $videoDirectory 'narration.wav'
$outputVideo = Join-Path $videoDirectory 'computer-use-demo-narrated.webm'
$ffmpeg = Join-Path $projectRoot 'node_modules\ffmpeg-static\ffmpeg.exe'

if (-not (Test-Path -LiteralPath $sourceVideo)) { throw "Missing source video: $sourceVideo" }
if (-not (Test-Path -LiteralPath $ffmpeg)) { throw 'Run npm ci before adding narration.' }

$text = @'
This project teaches an automation system how to use software that has no API. During discovery, an OpenAI model observes the live banking interface and chooses one safe action at a time. It enters a synthetic member number, searches, opens the member record, and reads the savings balance. The verified workflow is saved as a typed, reusable capability. Replay then runs those exact steps with different input data, validates every checkpoint, and returns a structured balance with zero model calls. Policy checks, diagnostic evidence, and same-session human handoff keep execution controlled and auditable.
'@

$voice = New-Object -ComObject SAPI.SpVoice
$voice.Rate = 1
$voice.Volume = 100
$zira = $voice.GetVoices() | Where-Object { $_.GetDescription() -like '*Zira*' } | Select-Object -First 1
if ($zira) { $voice.Voice = $zira }
$stream = New-Object -ComObject SAPI.SpFileStream
$stream.Open($narrationFile, 3, $false)
$voice.AudioOutputStream = $stream
[void]$voice.Speak($text)
$stream.Close()

$previousPreference = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
$probe = (& $ffmpeg -i $sourceVideo 2>&1 | Out-String)
$ErrorActionPreference = $previousPreference
if ($probe -notmatch 'Duration:\s+(\d+):(\d+):(\d+\.\d+)') { throw 'Could not determine video duration.' }
$durationSeconds = ([int]$Matches[1] * 3600) + ([int]$Matches[2] * 60) + [double]$Matches[3]
& $ffmpeg -y -i $sourceVideo -i $narrationFile -filter_complex '[1:a]adelay=300|300,apad[a]' -map '0:v:0' -map '[a]' -c:v copy -c:a libopus -b:a 96k -t $durationSeconds $outputVideo
if ($LASTEXITCODE -ne 0) { throw "FFmpeg failed with exit code $LASTEXITCODE" }
Write-Output $outputVideo
