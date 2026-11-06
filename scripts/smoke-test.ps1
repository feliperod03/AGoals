# Prueba de humo de la API de tareas (agenda del dia, marcar hecha, posponer).
# Requiere la app corriendo (docker compose up -d y .\mvnw spring-boot:run).
# Uso:  .\scripts\smoke-test.ps1
# Crea tareas con fecha 2099-12-31 y las borra al terminar.
param([string]$Base = "http://localhost:8080/api/tareas")

$fecha = "2099-12-31"
$fallos = 0
$ids = @()

function Llamar($metodo, $url, $body = $null) {
    $p = @{ Method = $metodo; Uri = $url; ContentType = "application/json"; UseBasicParsing = $true }
    if ($body) { $p.Body = $body }
    try {
        $r = Invoke-WebRequest @p
        $json = $null
        if ($r.Content) { $json = $r.Content | ConvertFrom-Json }
        return @{ Status = [int]$r.StatusCode; Raw = [string]$r.Content; Json = $json }
    } catch {
        $status = 0
        if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode }
        return @{ Status = $status; Raw = ""; Json = $null }
    }
}

function Verificar($nombre, [bool]$ok, $detalle = "") {
    if ($ok) {
        Write-Host ("PASS  " + $nombre) -ForegroundColor Green
    } else {
        Write-Host ("FAIL  " + $nombre + "  " + $detalle) -ForegroundColor Red
        $script:fallos++
    }
}

# --- Comprobar que la app responde ---
$ping = Llamar "GET" ($Base + "/agenda?fecha=" + $fecha)
if ($ping.Status -ne 200) {
    Write-Host "La app no responde en $Base (status $($ping.Status)). Levanta la base y la app primero." -ForegroundColor Red
    exit 2
}

try {
    # --- Crear tres tareas ---
    $a = Llamar "POST" $Base ('{"titulo":"Reunion","fecha":"' + $fecha + '","horaInicio":"09:00","horaFin":"10:00"}')
    $b = Llamar "POST" $Base ('{"titulo":"Estudiar","prioridad":"ALTA","fecha":"' + $fecha + '"}')
    $c = Llamar "POST" $Base ('{"titulo":"Ordenar escritorio","prioridad":"BAJA","fecha":"' + $fecha + '"}')
    Verificar "crear tareas" (($a.Status -in 200, 201) -and ($b.Status -in 200, 201) -and ($c.Status -in 200, 201)) "status: $($a.Status), $($b.Status), $($c.Status)"
    foreach ($x in @($a, $b, $c)) { if ($x.Json) { $ids += $x.Json.id } }
    if ($ids.Count -ne 3) { throw "No se pudieron crear las tareas de prueba." }

    # --- Agenda del dia ---
    $ag = Llamar "GET" ($Base + "/agenda?fecha=" + $fecha)
    $conHora = @($ag.Json.conHora)
    $sinHora = @($ag.Json.sinHora | ForEach-Object { $_.titulo })
    Verificar "agenda: 1 tarea con hora" (($conHora.Count -eq 1) -and ($conHora[0].titulo -eq "Reunion"))
    Verificar "agenda: sueltas ordenadas por prioridad (ALTA primero)" (($sinHora -join ",") -eq "Estudiar,Ordenar escritorio") ($sinHora -join ",")

    # --- Marcar hecha (y repetir: idempotente) ---
    $h1 = Llamar "PATCH" ($Base + "/" + $b.Json.id + "/hecha")
    $h2 = Llamar "PATCH" ($Base + "/" + $b.Json.id + "/hecha")
    Verificar "marcar hecha" (($h1.Status -eq 200) -and ($h1.Raw -match '"estado":"HECHO"'))
    Verificar "marcar hecha otra vez (idempotente)" (($h2.Status -eq 200) -and ($h2.Raw -match '"estado":"HECHO"'))

    # --- Posponer sin body: +1 dia y contador 1 ---
    $p1 = Llamar "PATCH" ($Base + "/" + $c.Json.id + "/posponer")
    Verificar "posponer sin body (+1 dia, contador 1)" (($p1.Status -eq 200) -and ($p1.Raw -match '"fecha":"2100-01-01"') -and ($p1.Raw -match '"vecesPospuesta":1')) $p1.Raw

    # --- Posponer con fecha explicita: contador 2 ---
    $p2 = Llamar "PATCH" ($Base + "/" + $c.Json.id + "/posponer") '{"fecha":"2100-01-15"}'
    Verificar "posponer con fecha explicita (contador 2)" (($p2.Status -eq 200) -and ($p2.Raw -match '"fecha":"2100-01-15"') -and ($p2.Raw -match '"vecesPospuesta":2')) $p2.Raw

    # --- Casos de error ---
    $e1 = Llamar "PATCH" ($Base + "/" + $b.Json.id + "/posponer")
    Verificar "posponer una tarea hecha -> 409" ($e1.Status -eq 409) "status $($e1.Status)"
    $e2 = Llamar "PATCH" ($Base + "/999999/hecha")
    Verificar "marcar hecha inexistente -> 404" ($e2.Status -eq 404) "status $($e2.Status)"
    $e3 = Llamar "GET" ($Base + "/agenda")
    Verificar "agenda sin fecha -> 400" ($e3.Status -eq 400) "status $($e3.Status)"
    $e4 = Llamar "GET" ($Base + "/agenda?fecha=06-11-2026")
    Verificar "agenda con fecha mal formada -> 400" ($e4.Status -eq 400) "status $($e4.Status)"
    $e5 = Llamar "PATCH" ($Base + "/" + $c.Json.id + "/posponer") '{"fecha":"2000-01-01"}'
    Verificar "posponer a fecha no posterior -> 400" ($e5.Status -eq 400) "status $($e5.Status)"
}
catch {
    Write-Host ("ERROR en la prueba: " + $_) -ForegroundColor Red
    $fallos++
}
finally {
    foreach ($id in $ids) { [void](Llamar "DELETE" ($Base + "/" + $id)) }
    Write-Host "Datos de prueba borrados."
}

if ($fallos -eq 0) {
    Write-Host "TODO OK" -ForegroundColor Green
    exit 0
} else {
    Write-Host ("$fallos prueba(s) fallaron") -ForegroundColor Red
    exit 1
}
