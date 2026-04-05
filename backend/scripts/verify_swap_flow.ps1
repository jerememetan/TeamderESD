$ErrorActionPreference = 'Stop'

function CallApi {
  param(
    [string]$Method,
    [string]$Url,
    [object]$Body = $null
  )

  try {
    if ($null -ne $Body) {
      $jsonBody = $Body | ConvertTo-Json -Depth 10
      $response = Invoke-WebRequest -Method $Method -Uri $Url -ContentType 'application/json' -Body $jsonBody -UseBasicParsing
    } else {
      $response = Invoke-WebRequest -Method $Method -Uri $Url -UseBasicParsing
    }

    $parsed = $null
    if ($response.Content) {
      $parsed = $response.Content | ConvertFrom-Json
    }

    return [PSCustomObject]@{
      status = [int]$response.StatusCode
      body = $parsed
    }
  } catch {
    $resp = $_.Exception.Response
    if ($null -eq $resp) {
      throw
    }

    $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
    $text = $reader.ReadToEnd()
    $reader.Close()

    $parsed = $null
    if ($text) {
      try {
        $parsed = $text | ConvertFrom-Json
      } catch {
        $parsed = $text
      }
    }

    return [PSCustomObject]@{
      status = [int]$resp.StatusCode
      body = $parsed
    }
  }
}

$base = 'http://localhost:8000'
$section = '7f7b954e-0cf0-429c-8c01-f780f7c25007'
$team1 = '5d551fa6-e2c2-46a2-9743-bf0f9b4508d9'
$team2 = '1a900daa-90bf-478c-9a95-2452406a074b'

# Keep verification rerunnable by reopening the section for submissions.
$reopenSection = CallApi -Method 'PUT' -Url "$base/section/$section" -Body @{ stage = 'formed' }

$tag = [DateTime]::UtcNow.ToString('yyyyMMddHHmmss')
$reasonA = "verify-$tag-A"
$reasonB = "verify-$tag-B"
$reasonC = "verify-$tag-C"

$submitA = CallApi -Method 'POST' -Url "$base/swap-orchestrator/submission/requests" -Body @{
  section_id = $section
  student_id = 44
  current_team = $team1
  reason = $reasonA
}
$submitB = CallApi -Method 'POST' -Url "$base/swap-orchestrator/submission/requests" -Body @{
  section_id = $section
  student_id = 45
  current_team = $team2
  reason = $reasonB
}

$review1 = CallApi -Method 'GET' -Url "$base/swap-orchestrator/review/requests?section_id=$section"
$rows1 = @()
if ($review1.body -and $review1.body.data -and $review1.body.data.requests) {
  $rows1 = $review1.body.data.requests
}

$rowA = $rows1 | Where-Object { $_.reason -eq $reasonA } | Select-Object -First 1
$rowB = $rows1 | Where-Object { $_.reason -eq $reasonB } | Select-Object -First 1

$approveA = $null
$rejectB = $null
$reapproveRejected = $null
if ($rowA) {
  $approveA = CallApi -Method 'PATCH' -Url "$base/swap-orchestrator/review/requests/$($rowA.id)/decision" -Body @{ decision = 'APPROVED' }
}
if ($rowB) {
  $rejectB = CallApi -Method 'PATCH' -Url "$base/swap-orchestrator/review/requests/$($rowB.id)/decision" -Body @{ decision = 'REJECTED' }
  $reapproveRejected = CallApi -Method 'PATCH' -Url "$base/swap-orchestrator/review/requests/$($rowB.id)/decision" -Body @{ decision = 'APPROVED' }
}

$submitC = CallApi -Method 'POST' -Url "$base/swap-orchestrator/submission/requests" -Body @{
  section_id = $section
  student_id = 40
  current_team = $team2
  reason = $reasonC
}

$review2 = CallApi -Method 'GET' -Url "$base/swap-orchestrator/review/requests?section_id=$section"
$rows2 = @()
if ($review2.body -and $review2.body.data -and $review2.body.data.requests) {
  $rows2 = $review2.body.data.requests
}
$rowC = $rows2 | Where-Object { $_.reason -eq $reasonC } | Select-Object -First 1

$approveC = $null
if ($rowC) {
  $approveC = CallApi -Method 'PATCH' -Url "$base/swap-orchestrator/review/requests/$($rowC.id)/decision" -Body @{ decision = 'APPROVED' }
}

$beforeTeamsResp = CallApi -Method 'GET' -Url "$base/team?section_id=$section"
$beforeMap = @{}
if ($beforeTeamsResp.body -and $beforeTeamsResp.body.data -and $beforeTeamsResp.body.data.teams) {
  foreach ($team in $beforeTeamsResp.body.data.teams) {
    foreach ($student in $team.students) {
      $beforeMap['' + $student.student_id] = '' + $team.team_id
    }
  }
}

$confirm = CallApi -Method 'POST' -Url "$base/swap-orchestrator/sections/$section/confirm"

$afterTeamsResp = CallApi -Method 'GET' -Url "$base/team?section_id=$section"
$afterMap = @{}
if ($afterTeamsResp.body -and $afterTeamsResp.body.data -and $afterTeamsResp.body.data.teams) {
  foreach ($team in $afterTeamsResp.body.data.teams) {
    foreach ($student in $team.students) {
      $afterMap['' + $student.student_id] = '' + $team.team_id
    }
  }
}

$finalReview = CallApi -Method 'GET' -Url "$base/swap-orchestrator/review/requests?section_id=$section"
$finalRows = @()
if ($finalReview.body -and $finalReview.body.data -and $finalReview.body.data.requests) {
  $finalRows = $finalReview.body.data.requests
}

$finalA = if ($rowA) { $finalRows | Where-Object { $_.id -eq $rowA.id } | Select-Object -First 1 } else { $null }
$finalB = if ($rowB) { $finalRows | Where-Object { $_.id -eq $rowB.id } | Select-Object -First 1 } else { $null }
$finalC = if ($rowC) { $finalRows | Where-Object { $_.id -eq $rowC.id } | Select-Object -First 1 } else { $null }

$sectionAfter = CallApi -Method 'GET' -Url "$base/section/$section"

$nonRequestedUnchanged = $true
foreach ($studentId in $beforeMap.Keys) {
  if (@('44', '45', '40') -contains ('' + $studentId)) {
    continue
  }
  if ($beforeMap[$studentId] -ne $afterMap[$studentId]) {
    $nonRequestedUnchanged = $false
    break
  }
}

$result = [PSCustomObject]@{
  section_id = $section
  submissions = [PSCustomObject]@{
    a = $submitA.status
    b = $submitB.status
    c = $submitC.status
  }
  enrichment = [PSCustomObject]@{
    a_has_studentName = [bool]($rowA -and $rowA.studentName)
    a_has_courseName = [bool]($rowA -and $rowA.courseName)
    a_has_sectionNumber = [bool]($rowA -and $rowA.sectionNumber)
  }
  decisions = [PSCustomObject]@{
    approve_a = if ($approveA) { $approveA.status } else { $null }
    reject_b = if ($rejectB) { $rejectB.status } else { $null }
    reapprove_rejected = if ($reapproveRejected) { $reapproveRejected.status } else { $null }
    approve_c = if ($approveC) { $approveC.status } else { $null }
  }
  confirm_status = $confirm.status
  final_status = [PSCustomObject]@{
    a = if ($finalA) { '' + $finalA.status } else { $null }
    b = if ($finalB) { '' + $finalB.status } else { $null }
    c = if ($finalC) { '' + $finalC.status } else { $null }
  }
  section_stage_after = if ($sectionAfter.body -and $sectionAfter.body.data -and $sectionAfter.body.data.stage) { '' + $sectionAfter.body.data.stage } else { $null }
  non_requested_unchanged = $nonRequestedUnchanged
}

$result | ConvertTo-Json -Depth 8 -Compress
