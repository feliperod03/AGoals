# Prueba de humo de la API: tareas (agenda del dia, marcar hecha, posponer) y proyectos
# (jerarquia, ciclos, asignar tareas, borrado con 409).
# Requiere la app corriendo (docker compose up -d y .\mvnw spring-boot:run).
# Uso:  .\scripts\smoke-test.ps1
# Crea tareas con fecha 2099-12-31 y proyectos "smoke-*", y los borra al terminar.
param(
    [string]$Base = "http://localhost:8080/api/tareas",
    [string]$BaseProyectos = "http://localhost:8080/api/proyectos"
)

$fecha = "2099-12-31"
$fallos = 0
$ids = @()
$proyectoIds = @()

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

    # --- Proyectos: jerarquia, ciclos, tareas y borrado ---
    $pa = Llamar "POST" $BaseProyectos '{"nombre":"smoke-A","prioridad":"ALTA"}'
    Verificar "crear proyecto A" (($pa.Status -eq 201) -and ($pa.Raw -match '"estado":"PENDIENTE"')) $pa.Raw
    if ($pa.Json) { $proyectoIds += $pa.Json.id }
    if (-not $pa.Json) { throw "No se pudo crear el proyecto A." }

    $pb = Llamar "POST" $BaseProyectos ('{"nombre":"smoke-B","padreId":' + $pa.Json.id + '}')
    Verificar "crear proyecto B con padre A" (($pb.Status -eq 201) -and ($pb.Json.padreId -eq $pa.Json.id)) $pb.Raw
    if ($pb.Json) { $proyectoIds += $pb.Json.id }
    if (-not $pb.Json) { throw "No se pudo crear el proyecto B." }

    $pc1 = Llamar "PUT" ($BaseProyectos + "/" + $pa.Json.id) ('{"nombre":"smoke-A","padreId":' + $pb.Json.id + '}')
    Verificar "poner A bajo B (ciclo) -> 400" ($pc1.Status -eq 400) "status $($pc1.Status)"
    $pc2 = Llamar "PUT" ($BaseProyectos + "/" + $pa.Json.id) ('{"nombre":"smoke-A","padreId":' + $pa.Json.id + '}')
    Verificar "A como su propio padre -> 400" ($pc2.Status -eq 400) "status $($pc2.Status)"
    $pc3 = Llamar "POST" $BaseProyectos '{"nombre":"smoke-X","padreId":999999}'
    Verificar "crear con padre inexistente -> 400" ($pc3.Status -eq 400) "status $($pc3.Status)"
    $pc4 = Llamar "POST" $BaseProyectos '{"nombre":"smoke-Y","objetivoId":999999}'
    Verificar "crear con objetivoId inexistente -> 400" ($pc4.Status -eq 400) "status $($pc4.Status)"
    $pc5 = Llamar "GET" ($BaseProyectos + "/999999")
    Verificar "proyecto inexistente -> 404" ($pc5.Status -eq 404) "status $($pc5.Status)"

    $pl = Llamar "GET" ($BaseProyectos + "?estado=PENDIENTE")
    $nombres = @($pl.Json | ForEach-Object { $_.nombre })
    Verificar "listar con filtro estado=PENDIENTE" (($pl.Status -eq 200) -and ($nombres -contains "smoke-A") -and ($nombres -contains "smoke-B")) ($nombres -join ",")
    $pl2 = Llamar "GET" ($BaseProyectos + "?estado=HECHO")
    $nombres2 = @($pl2.Json | ForEach-Object { $_.nombre })
    Verificar "listar con filtro estado=HECHO no trae A ni B" (($pl2.Status -eq 200) -and ($nombres2 -notcontains "smoke-A") -and ($nombres2 -notcontains "smoke-B")) ($nombres2 -join ",")

    $as = Llamar "PUT" ($BaseProyectos + "/" + $pb.Json.id + "/tareas/" + $a.Json.id)
    Verificar "asignar tarea a B" (($as.Status -eq 200) -and ($as.Json.proyectoId -eq $pb.Json.id)) $as.Raw
    $lt = Llamar "GET" ($BaseProyectos + "/" + $pb.Json.id + "/tareas")
    Verificar "listar tareas de B" (($lt.Status -eq 200) -and (@($lt.Json).Count -eq 1) -and (@($lt.Json)[0].id -eq $a.Json.id)) $lt.Raw
    $as2 = Llamar "PUT" ($BaseProyectos + "/" + $pb.Json.id + "/tareas/999999")
    Verificar "asignar tarea inexistente -> 404" ($as2.Status -eq 404) "status $($as2.Status)"
    $as3 = Llamar "PUT" ($BaseProyectos + "/999999/tareas/" + $a.Json.id)
    Verificar "asignar a proyecto inexistente -> 404" ($as3.Status -eq 404) "status $($as3.Status)"

    $d1 = Llamar "DELETE" ($BaseProyectos + "/" + $pb.Json.id)
    Verificar "borrar B con tareas -> 409" ($d1.Status -eq 409) "status $($d1.Status)"
    $d2 = Llamar "DELETE" ($BaseProyectos + "/" + $pa.Json.id)
    Verificar "borrar A con subproyectos -> 409" ($d2.Status -eq 409) "status $($d2.Status)"

    $ds1 = Llamar "DELETE" ($BaseProyectos + "/" + $pa.Json.id + "/tareas/" + $a.Json.id)
    Verificar "desasignar tarea que no es de A -> 400" ($ds1.Status -eq 400) "status $($ds1.Status)"
    $ds2 = Llamar "DELETE" ($BaseProyectos + "/" + $pb.Json.id + "/tareas/" + $a.Json.id)
    Verificar "desasignar tarea de B -> 204" ($ds2.Status -eq 204) "status $($ds2.Status)"

    $d3 = Llamar "DELETE" ($BaseProyectos + "/" + $pb.Json.id)
    Verificar "borrar B vacio -> 204" ($d3.Status -eq 204) "status $($d3.Status)"
    $d4 = Llamar "DELETE" ($BaseProyectos + "/" + $pa.Json.id)
    Verificar "borrar A sin hijos -> 204" ($d4.Status -eq 204) "status $($d4.Status)"
}
catch {
    Write-Host ("ERROR en la prueba: " + $_) -ForegroundColor Red
    $fallos++
}
finally {
    foreach ($id in $ids) { [void](Llamar "DELETE" ($Base + "/" + $id)) }
    # Limpieza de proyectos si la prueba fallo a medias: primero se desasignan tareas (ya borradas arriba)
    # y se borran los hijos antes que los padres (orden inverso de creacion).
    [array]::Reverse($proyectoIds)
    foreach ($id in $proyectoIds) { [void](Llamar "DELETE" ($BaseProyectos + "/" + $id)) }
    Write-Host "Datos de prueba borrados."
}

if ($fallos -eq 0) {
    Write-Host "TODO OK" -ForegroundColor Green
    exit 0
} else {
    Write-Host ("$fallos prueba(s) fallaron") -ForegroundColor Red
    exit 1
}
