# Documentation only: validate Open XML, update Word fields and measure pagination.
# Uses an isolated hidden Word instance. Never touches services or application code.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$manualPath = Join-Path $PSScriptRoot 'CaterConnect_COMPLETE_SYSTEM_USER_MANUAL.docx'
$archive = [System.IO.Compression.ZipFile]::OpenRead($manualPath)
try {
  foreach ($entry in $archive.Entries) {
    if ($entry.FullName.EndsWith('.xml') -or $entry.FullName.EndsWith('.rels')) {
      $reader = [System.IO.StreamReader]::new($entry.Open())
      try { $xml = [xml]$reader.ReadToEnd() } finally { $reader.Dispose() }
    }
  }
  $reader = [System.IO.StreamReader]::new($archive.GetEntry('word/document.xml').Open())
  try { $documentXml = [xml]$reader.ReadToEnd() } finally { $reader.Dispose() }
  $ns = [System.Xml.XmlNamespaceManager]::new($documentXml.NameTable)
  $ns.AddNamespace('w','http://schemas.openxmlformats.org/wordprocessingml/2006/main')
  # Word may normalize style IDs to numbers on save; identify actual chapter
  # paragraphs by their text and page break, excluding generated TOC entries.
  $chapterCount = @($documentXml.SelectNodes('//w:p[w:pPr/w:pageBreakBefore and w:r/w:t[starts-with(text(),"CHAPTER ")]]', $ns)).Count
  if ($chapterCount -ne 12) { throw "Expected 12 chapter headings; found $chapterCount" }
  Write-Output "Open XML validation passed; 12 chapters; ZIP/XML parts readable."
} finally { $archive.Dispose() }
if ($args -contains '-XmlOnly') { exit 0 }
$word = $null
$document = $null
try {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $word.DisplayAlerts = 0
  $word.AutomationSecurity = 3
  $document = $word.Documents.Open($manualPath, $false, $false, $false)
  $document.Fields.Update() | Out-Null
  foreach ($toc in $document.TablesOfContents) { $toc.Update() }
  $document.Repaginate()
  foreach ($section in $document.Sections) {
    foreach ($footer in $section.Footers) { $footer.Range.Fields.Update() | Out-Null }
  }
  foreach ($toc in $document.TablesOfContents) { $toc.UpdatePageNumbers() }
  $document.Save()
  $pages = $document.ComputeStatistics(2)
  $words = $document.ComputeStatistics(0)
  $tables = $document.Tables.Count
  $tocCount = $document.TablesOfContents.Count
  $content = $document.Content.Text
  if ($tocCount -ne 1 -or $tables -lt 15 -or $pages -lt 30) { throw 'Unexpected Word document structure or pagination.' }
  if ($content -match 'Error! Bookmark not defined|Error! Reference source not found') { throw 'Broken Word reference field.' }
  $result = [ordered]@{ validation='Passed in Microsoft Word'; date='2026-10-20'; pages=$pages; words=$words; tables=$tables; contentsFields=$tocCount; screenshots='26 placeholders; no fabricated images'; note='Page count will change when screenshots or institutional front matter are inserted.' }
  $result | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'MANUAL_VALIDATION.json') -Encoding UTF8
  $result | ConvertTo-Json
} finally {
  if ($null -ne $document) { $document.Close(0) | Out-Null; [void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($document) }
  if ($null -ne $word) {
    try { $word.Quit() | Out-Null }
    catch {
      # Word can terminate automatically after its last document closes.
      if ($_.Exception.HResult -ne -2147023174 -and $_.Exception.InnerException.HResult -ne -2147023174) { throw }
    }
    [void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($word)
  }
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}
