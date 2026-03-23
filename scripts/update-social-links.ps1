$baseDir = 'c:\Users\Klaus\Documents\Github_apps\BreakwaterAutoDetailing'
$fbUrl = 'https://www.facebook.com/profile.php?id=61578484807400'
$instaOldUrl = 'https://www.instagram.com/breakwaterautodetailing/'
$instaNewUrl = 'https://www.instagram.com/breakwater.detail/'

$instaFooterOld = '            <a class="social-link social-link-instagram" href="' + $instaOldUrl + '" target="_blank" rel="noopener noreferrer" aria-label="Visit Breakwater Auto Detailing on Instagram" title="Instagram"><span class="social-link-icon" aria-hidden="true">&#128247;</span><span class="sr-only">Instagram</span></a>'
$instaFooterNew = '            <a class="social-link social-link-instagram" href="' + $instaNewUrl + '" target="_blank" rel="noopener noreferrer" aria-label="Visit Breakwater Auto Detailing on Instagram" title="Instagram"><span class="social-link-icon" aria-hidden="true">&#128247;</span><span class="sr-only">Instagram</span></a>'
$fbFooterLink   = '            <a class="social-link social-link-facebook" href="' + $fbUrl + '" target="_blank" rel="noopener noreferrer" aria-label="Visit Breakwater Auto Detailing on Facebook" title="Facebook"><span class="social-link-icon" aria-hidden="true">f</span><span class="sr-only">Facebook</span></a>'

$instaContactOld = '              <a class="social-link social-link-instagram" href="' + $instaOldUrl + '" target="_blank" rel="noopener noreferrer" aria-label="Visit Breakwater Auto Detailing on Instagram" title="Instagram"><span class="social-link-icon" aria-hidden="true">&#128247;</span><span class="sr-only">Instagram</span></a>'
$instaContactNew = '              <a class="social-link social-link-instagram" href="' + $instaNewUrl + '" target="_blank" rel="noopener noreferrer" aria-label="Visit Breakwater Auto Detailing on Instagram" title="Instagram"><span class="social-link-icon" aria-hidden="true">&#128247;</span><span class="sr-only">Instagram</span></a>'
$fbContactLink   = '              <a class="social-link social-link-facebook" href="' + $fbUrl + '" target="_blank" rel="noopener noreferrer" aria-label="Visit Breakwater Auto Detailing on Facebook" title="Facebook"><span class="social-link-icon" aria-hidden="true">f</span><span class="sr-only">Facebook</span></a>'

$files = Get-ChildItem -Path $baseDir -Filter '*.html' -Recurse

foreach ($file in $files) {
    $content = [System.IO.File]::ReadAllText($file.FullName)
    $nl = if ($content.Contains("`r`n")) { "`r`n" } else { "`n" }
    $changed = $false

    # Replace Instagram footer link (12-space indent) and add Facebook after it
    if ($content.Contains($instaFooterOld)) {
        $content = $content.Replace($instaFooterOld, $instaFooterNew + $nl + $fbFooterLink)
        $changed = $true
    }

    # Replace Instagram contact link (14-space indent) and add Facebook after it
    if ($content.Contains($instaContactOld)) {
        $content = $content.Replace($instaContactOld, $instaContactNew + $nl + $fbContactLink)
        $changed = $true
    }

    # Replace remaining old Instagram URL (in JSON-LD sameAs)
    if ($content.Contains($instaOldUrl)) {
        $content = $content.Replace($instaOldUrl, $instaNewUrl)
        $changed = $true
    }

    # Add Facebook URL to JSON-LD sameAs array (after Pinterest entry)
    $pinterestLine = '      "https://www.pinterest.com/breakwaterauto/"'
    $fbJsonLine    = '      "' + $fbUrl + '"'
    $pinterestOldCR = $pinterestLine + "`r`n    ]"
    $pinterestOldLF = $pinterestLine + "`n    ]"
    if ($content.Contains($pinterestOldCR)) {
        $content = $content.Replace($pinterestOldCR, $pinterestLine + ',' + "`r`n" + $fbJsonLine + "`r`n    ]")
        $changed = $true
    } elseif ($content.Contains($pinterestOldLF)) {
        $content = $content.Replace($pinterestOldLF, $pinterestLine + ',' + "`n" + $fbJsonLine + "`n    ]")
        $changed = $true
    }

    if ($changed) {
        [System.IO.File]::WriteAllText($file.FullName, $content)
        Write-Host "Updated: $($file.Name)"
    }
}

Write-Host 'All done!'
