$baseUrl = "http://localhost:3000/api/v1"

$planBody = @{
    clientId = "c1"
    title = "Strength Plan"
    goal = "muscle_gain"
    weeks = 8
}

$plan = Invoke-RestMethod `
    -Method Post `
    -Uri "$baseUrl/workout-plans" `
    -ContentType "application/json" `
    -Body ($planBody | ConvertTo-Json -Compress)

Write-Host "Created plan:"
$plan | ConvertTo-Json

Write-Host "Plan details:"
Invoke-RestMethod -Uri "$baseUrl/workout-plans/$($plan.id)" | ConvertTo-Json

$logBody = @{
    clientId = "c1"
    planId = $plan.id
    date = "2026-11-20"
    exercise = "Squat"
    sets = 4
    reps = 5
    weightKg = 80
}

$log = Invoke-RestMethod `
    -Method Post `
    -Uri "$baseUrl/workout-logs" `
    -ContentType "application/json" `
    -Body ($logBody | ConvertTo-Json -Compress)

Write-Host "Created workout log:"
$log | ConvertTo-Json

Write-Host "Client progress:"
Invoke-RestMethod -Uri "$baseUrl/clients/c1/progress" | ConvertTo-Json
