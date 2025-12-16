# Run this from the project root (where src/ exists)

$base = "src\sim"

# Folder structure
$folders = @(
    "$base",
    "$base\model",
    "$base\engine",
    "$base\ui"
)

# File structure
$files = @(
    "$base\model\types.js",
    "$base\model\gates.js",
    "$base\engine\simulate.js",
    "$base\ui\Editor.jsx",
    "$base\ui\Canvas.jsx"
)

# Create folders
foreach ($folder in $folders) {
    if (-not (Test-Path $folder)) {
        New-Item -ItemType Directory -Path $folder | Out-Null
        Write-Host "Created folder: $folder"
    } else {
        Write-Host "Folder already exists: $folder"
    }
}

# Create empty files
foreach ($file in $files) {
    if (-not (Test-Path $file)) {
        New-Item -ItemType File -Path $file | Out-Null
        Write-Host "Created file: $file"
    } else {
        Write-Host "File already exists: $file"
    }
}

Write-Host "`n✅ Circuit simulator structure ready!"
