# Prueba de humo de la API: tareas (agenda del dia, marcar hecha, posponer), proyectos
# (jerarquia, ciclos, asignar tareas, borrado con 409) y objetivos (jerarquia, ciclos,
# proyectos y tareas ligados, borrado con 409 segun el motivo), atrasadas, reabrir, recomendacion
# y agendar una tarea con sus subtareas, e ideas (libres o ligadas a un proyecto/objetivo, concluir,
# reabrir y 409 al borrar un proyecto u objetivo con ideas), y eventos (CRUD, PUT completo, listado por
# solapamiento con desde/hasta usando fechas con desfase -03:00, y validaciones), y recordatorios (de tarea,
# de evento o sueltos; vencidos con bordes, PUT, marcar-enviado, 409 por duplicado y borrado en cascada), y borrar una tarea con subtareas eligiendo borrar o conservar.
# Requiere la app corriendo (docker compose up -d y .\mvnw spring-boot:run).
# Uso:  .\scripts\smoke-test.ps1
# Crea tareas con fecha 2099-12-31, y proyectos, objetivos, ideas y eventos "smoke-*", y los borra al terminar.
param(
    [string]$Base = "http://localhost:8080/api/tareas",
    [string]$BaseProyectos = "http://localhost:8080/api/proyectos",
    [string]$BaseObjetivos = "http://localhost:8080/api/objetivos",
    [string]$BaseIdeas = "http://localhost:8080/api/ideas",
    [string]$BaseEventos = "http://localhost:8080/api/eventos",
    [string]$BaseRecordatorios = "http://localhost:8080/api/recordatorios"
)

$fecha = "2099-12-31"
$fallos = 0
$ids = @()
$proyectoIds = @()
$objetivoIds = @()
$ideaIds = @()
$eventoIds = @()
$recordatorioIds = @()

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
        # En los errores, Raw trae el cuerpo de la respuesta (el mensaje del API) si PowerShell lo expone.
        $raw = ""
        if ($_.ErrorDetails -and $_.ErrorDetails.Message) {
            $raw = [string]$_.ErrorDetails.Message
        } elseif ($_.Exception.Response) {
            # Windows PowerShell 5.1: el cuerpo del error hay que leerlo del stream de la respuesta.
            try {
                $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
                $raw = $reader.ReadToEnd()
                $reader.Close()
            } catch { }
        }
        return @{ Status = $status; Raw = $raw; Json = $null }
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
    Verificar "crear con objetivoId inexistente -> 400 'El objetivo no existe'" (($pc4.Status -eq 400) -and ($pc4.Raw -match "El objetivo no existe: 999999")) "status $($pc4.Status) $($pc4.Raw)"
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

    # --- Objetivos: jerarquia, ciclos, proyectos, tareas y borrado con 409 por motivo ---
    $o1 = Llamar "POST" $BaseObjetivos '{"nombre":"smoke-O1","prioridad":"ALTA"}'
    Verificar "crear objetivo O1" (($o1.Status -eq 201) -and ($o1.Raw -match '"estado":"PENDIENTE"')) $o1.Raw
    if ($o1.Json) { $objetivoIds += $o1.Json.id }
    if (-not $o1.Json) { throw "No se pudo crear el objetivo O1." }

    $o2 = Llamar "POST" $BaseObjetivos ('{"nombre":"smoke-O2","padreId":' + $o1.Json.id + '}')
    Verificar "crear subobjetivo O2 con padre O1" (($o2.Status -eq 201) -and ($o2.Json.padreId -eq $o1.Json.id)) $o2.Raw
    if ($o2.Json) { $objetivoIds += $o2.Json.id }
    if (-not $o2.Json) { throw "No se pudo crear el objetivo O2." }

    $oc1 = Llamar "PUT" ($BaseObjetivos + "/" + $o1.Json.id) ('{"nombre":"smoke-O1","padreId":' + $o2.Json.id + '}')
    Verificar "poner O1 bajo O2 (ciclo) -> 400" ($oc1.Status -eq 400) "status $($oc1.Status)"
    $oc2 = Llamar "PUT" ($BaseObjetivos + "/" + $o1.Json.id) ('{"nombre":"smoke-O1","padreId":' + $o1.Json.id + '}')
    Verificar "O1 como su propio padre -> 400" ($oc2.Status -eq 400) "status $($oc2.Status)"
    $oc3 = Llamar "POST" $BaseObjetivos '{"nombre":"smoke-X","padreId":999999}'
    Verificar "crear objetivo con padre inexistente -> 400" ($oc3.Status -eq 400) "status $($oc3.Status)"
    $oc4 = Llamar "GET" ($BaseObjetivos + "/999999")
    Verificar "objetivo inexistente -> 404" ($oc4.Status -eq 404) "status $($oc4.Status)"

    $ol = Llamar "GET" ($BaseObjetivos + "?estado=PENDIENTE")
    $onombres = @($ol.Json | ForEach-Object { $_.nombre })
    Verificar "listar objetivos con filtro estado=PENDIENTE" (($ol.Status -eq 200) -and ($onombres -contains "smoke-O1") -and ($onombres -contains "smoke-O2")) ($onombres -join ",")
    $ol2 = Llamar "GET" ($BaseObjetivos + "?estado=HECHO")
    $onombres2 = @($ol2.Json | ForEach-Object { $_.nombre })
    Verificar "listar objetivos con estado=HECHO no trae O1 ni O2" (($ol2.Status -eq 200) -and ($onombres2 -notcontains "smoke-O1") -and ($onombres2 -notcontains "smoke-O2")) ($onombres2 -join ",")

    # Proyecto ligado al objetivo (objetivoId validado por ObjetivoConsultaService)
    $po = Llamar "POST" $BaseProyectos ('{"nombre":"smoke-PO","objetivoId":' + $o1.Json.id + '}')
    Verificar "crear proyecto con objetivoId existente" (($po.Status -eq 201) -and ($po.Json.objetivoId -eq $o1.Json.id)) $po.Raw
    if ($po.Json) { $proyectoIds += $po.Json.id }
    if (-not $po.Json) { throw "No se pudo crear el proyecto ligado al objetivo." }
    $pf = Llamar "GET" ($BaseProyectos + "?objetivoId=" + $o1.Json.id)
    $pfn = @($pf.Json | ForEach-Object { $_.nombre })
    Verificar "listar proyectos filtrando por objetivoId" (($pf.Status -eq 200) -and ($pfn -contains "smoke-PO")) ($pfn -join ",")

    # Tareas ligadas directamente al objetivo
    $ot = Llamar "PUT" ($BaseObjetivos + "/" + $o1.Json.id + "/tareas/" + $c.Json.id)
    Verificar "asignar tarea a O1" (($ot.Status -eq 200) -and ($ot.Json.objetivoId -eq $o1.Json.id)) $ot.Raw
    $otl = Llamar "GET" ($BaseObjetivos + "/" + $o1.Json.id + "/tareas")
    Verificar "listar tareas de O1" (($otl.Status -eq 200) -and (@($otl.Json).Count -eq 1) -and (@($otl.Json)[0].id -eq $c.Json.id)) $otl.Raw
    $ot2 = Llamar "PUT" ($BaseObjetivos + "/" + $o1.Json.id + "/tareas/999999")
    Verificar "asignar tarea inexistente a objetivo -> 404" ($ot2.Status -eq 404) "status $($ot2.Status)"
    $ot3 = Llamar "PUT" ($BaseObjetivos + "/999999/tareas/" + $c.Json.id)
    Verificar "asignar tarea a objetivo inexistente -> 404" ($ot3.Status -eq 404) "status $($ot3.Status)"

    # Borrado: cada 409 dice su motivo (subobjetivos, luego proyectos, luego tareas)
    $od1 = Llamar "DELETE" ($BaseObjetivos + "/" + $o1.Json.id)
    Verificar "borrar O1 con subobjetivos -> 409 (subobjetivos)" (($od1.Status -eq 409) -and ($od1.Raw -match "subobjetivos")) "status $($od1.Status) $($od1.Raw)"
    $od2 = Llamar "DELETE" ($BaseObjetivos + "/" + $o2.Json.id)
    Verificar "borrar O2 vacio -> 204" ($od2.Status -eq 204) "status $($od2.Status)"
    $od3 = Llamar "DELETE" ($BaseObjetivos + "/" + $o1.Json.id)
    Verificar "borrar O1 con proyectos -> 409 (proyectos)" (($od3.Status -eq 409) -and ($od3.Raw -match "proyectos")) "status $($od3.Status) $($od3.Raw)"
    $od4 = Llamar "DELETE" ($BaseProyectos + "/" + $po.Json.id)
    Verificar "borrar el proyecto del objetivo -> 204" ($od4.Status -eq 204) "status $($od4.Status)"
    $od5 = Llamar "DELETE" ($BaseObjetivos + "/" + $o1.Json.id)
    Verificar "borrar O1 con tareas -> 409 (tareas)" (($od5.Status -eq 409) -and ($od5.Raw -match "tareas")) "status $($od5.Status) $($od5.Raw)"

    $ods1 = Llamar "DELETE" ($BaseObjetivos + "/" + $o1.Json.id + "/tareas/" + $a.Json.id)
    Verificar "desasignar tarea que no es de O1 -> 400" ($ods1.Status -eq 400) "status $($ods1.Status)"
    $ods2 = Llamar "DELETE" ($BaseObjetivos + "/" + $o1.Json.id + "/tareas/" + $c.Json.id)
    Verificar "desasignar tarea de O1 -> 204" ($ods2.Status -eq 204) "status $($ods2.Status)"
    $od6 = Llamar "DELETE" ($BaseObjetivos + "/" + $o1.Json.id)
    Verificar "borrar O1 vacio -> 204" ($od6.Status -eq 204) "status $($od6.Status)"

    # --- Tareas atrasadas ---
    # Fechas en 2098 para no mezclarse con datos reales; la respuesta se filtra a los titulos "smoke-at-*"
    # porque la base puede tener tareas reales vencidas.
    $limite = "2098-01-10"
    $t1 = Llamar "POST" $Base '{"titulo":"smoke-at-1 baja","prioridad":"BAJA","fecha":"2098-01-05"}'
    $t2 = Llamar "POST" $Base '{"titulo":"smoke-at-2 alta","prioridad":"ALTA","fecha":"2098-01-05"}'
    $t3 = Llamar "POST" $Base '{"titulo":"smoke-at-3 mas vieja","fecha":"2098-01-01"}'
    $t4 = Llamar "POST" $Base ('{"titulo":"smoke-at-4 en el limite","fecha":"' + $limite + '"}')
    $t5 = Llamar "POST" $Base '{"titulo":"smoke-at-5 sin fecha"}'
    $t6 = Llamar "POST" $Base '{"titulo":"smoke-at-6 hecha","estado":"HECHO","fecha":"2098-01-02"}'
    $t7 = Llamar "POST" $Base '{"titulo":"smoke-at-7 en progreso","estado":"EN_PROGRESO","fecha":"2098-01-03"}'
    foreach ($x in @($t1, $t2, $t3, $t4, $t5, $t6, $t7)) { if ($x.Json) { $ids += $x.Json.id } }
    Verificar "crear tareas para atrasadas" (($t1.Status -eq 201) -and ($t7.Status -eq 201)) "status: $($t1.Status), $($t7.Status)"
    if (-not ($t1.Json -and $t2.Json -and $t3.Json -and $t6.Json -and $t7.Json)) { throw "No se pudieron crear las tareas de atrasadas." }

    $at = Llamar "GET" ($Base + "/atrasadas?fecha=" + $limite)
    $titulos = @($at.Json | ForEach-Object { $_.titulo } | Where-Object { $_ -like "smoke-at-*" })
    Verificar "atrasadas: excluye limite, sin fecha y hechas; orden fecha y prioridad" (($at.Status -eq 200) -and (($titulos -join "|") -eq "smoke-at-3 mas vieja|smoke-at-7 en progreso|smoke-at-2 alta|smoke-at-1 baja")) ($titulos -join "|")
    $at2 = Llamar "GET" ($Base + "/atrasadas")
    Verificar "atrasadas sin fecha -> 400" ($at2.Status -eq 400) "status $($at2.Status)"
    $at3 = Llamar "GET" ($Base + "/atrasadas?fecha=10-01-2098")
    Verificar "atrasadas con fecha mal formada -> 400" ($at3.Status -eq 400) "status $($at3.Status)"

    # --- Reabrir ---
    $h = Llamar "PATCH" ($Base + "/" + $t2.Json.id + "/hecha")
    $r1 = Llamar "PATCH" ($Base + "/" + $t2.Json.id + "/reabrir")
    Verificar "reabrir una hecha -> PENDIENTE" (($h.Status -eq 200) -and ($r1.Status -eq 200) -and ($r1.Json.estado -eq "PENDIENTE")) $r1.Raw
    $r2 = Llamar "PATCH" ($Base + "/" + $t2.Json.id + "/reabrir")
    Verificar "reabrir una ya abierta (idempotente)" (($r2.Status -eq 200) -and ($r2.Json.estado -eq "PENDIENTE")) $r2.Raw
    $r3 = Llamar "PATCH" ($Base + "/" + $t7.Json.id + "/reabrir")
    Verificar "reabrir EN_PROGRESO la deja EN_PROGRESO" (($r3.Status -eq 200) -and ($r3.Json.estado -eq "EN_PROGRESO")) $r3.Raw
    $r4 = Llamar "PATCH" ($Base + "/" + $t6.Json.id + "/reabrir")
    $at4 = Llamar "GET" ($Base + "/atrasadas?fecha=" + $limite)
    $titulos2 = @($at4.Json | ForEach-Object { $_.titulo } | Where-Object { $_ -like "smoke-at-*" })
    Verificar "una tarea reabierta vuelve a las atrasadas" (($r4.Status -eq 200) -and ($titulos2 -contains "smoke-at-6 hecha")) ($titulos2 -join "|")
    $tc = Llamar "POST" $Base '{"titulo":"smoke-at-8 cancelada","estado":"CANCELADO","fecha":"2098-01-04"}'
    if ($tc.Json) { $ids += $tc.Json.id }
    if (-not $tc.Json) { throw "No se pudo crear la tarea cancelada." }
    $r5 = Llamar "PATCH" ($Base + "/" + $tc.Json.id + "/reabrir")
    Verificar "reabrir una cancelada -> 409" (($r5.Status -eq 409) -and ($r5.Raw -match "cancelada")) "status $($r5.Status) $($r5.Raw)"
    $r6 = Llamar "PATCH" ($Base + "/999999/reabrir")
    Verificar "reabrir inexistente -> 404" ($r6.Status -eq 404) "status $($r6.Status)"

    # --- Recomendacion (sin fecha o atrasadas) ---
    # Se filtra por un proyecto propio para aislarse de las tareas reales de la base.
    $rp = Llamar "POST" $BaseProyectos '{"nombre":"smoke-rc-P"}'
    if ($rp.Json) { $proyectoIds += $rp.Json.id }
    if (-not $rp.Json) { throw "No se pudo crear el proyecto de recomendacion." }
    $rm = Llamar "POST" $Base '{"titulo":"smoke-rc-M madre","prioridad":"ALTA"}'
    if ($rm.Json) { $ids += $rm.Json.id }
    if (-not $rm.Json) { throw "No se pudo crear la madre de recomendacion." }
    $rh = Llamar "POST" $Base ('{"titulo":"smoke-rc-H hija atrasada","prioridad":"BAJA","fecha":"2098-01-01","padreId":' + $rm.Json.id + '}')
    if ($rh.Json) { $ids += $rh.Json.id }
    $rx = Llamar "POST" $Base '{"titulo":"smoke-rc-X sin fecha","prioridad":"MEDIA"}'
    if ($rx.Json) { $ids += $rx.Json.id }
    $rw = Llamar "POST" $Base '{"titulo":"smoke-rc-W atrasada","prioridad":"BAJA","fecha":"2098-01-05"}'
    if ($rw.Json) { $ids += $rw.Json.id }
    $ry = Llamar "POST" $Base ('{"titulo":"smoke-rc-Y en el limite","fecha":"' + $limite + '"}')
    if ($ry.Json) { $ids += $ry.Json.id }
    $rz = Llamar "POST" $Base '{"titulo":"smoke-rc-Z hecha","estado":"HECHO","fecha":"2098-01-01"}'
    if ($rz.Json) { $ids += $rz.Json.id }
    if (-not ($rh.Json -and $rx.Json -and $rw.Json -and $ry.Json -and $rz.Json)) { throw "No se pudieron crear las tareas de recomendacion." }
    # La hija H queda SIN proyecto a proposito: debe aparecer anidada bajo su madre al filtrar por el proyecto.
    foreach ($x in @($rm, $rx, $rw, $ry, $rz)) { [void](Llamar "PUT" ($BaseProyectos + "/" + $rp.Json.id + "/tareas/" + $x.Json.id)) }
    $filtro = "&proyectoId=" + $rp.Json.id

    $rc = Llamar "GET" ($Base + "/recomendacion?fecha=" + $limite + $filtro)
    $raices = @($rc.Json | ForEach-Object { $_.tarea.titulo })
    Verificar "recomendacion: prioridad desc; excluye limite, hechas; hija no es raiz" (($rc.Status -eq 200) -and (($raices -join "|") -eq "smoke-rc-M madre|smoke-rc-X sin fecha|smoke-rc-W atrasada")) ($raices -join "|")
    $subs = @($rc.Json[0].subtareas | ForEach-Object { $_.tarea.titulo })
    Verificar "recomendacion: la subtarea sin proyecto va anidada bajo su madre" (($subs -join "|") -eq "smoke-rc-H hija atrasada") ($subs -join "|")
    $rc2 = Llamar "GET" ($Base + "/recomendacion?fecha=" + $limite + $filtro + "&orden=prioridad&sentido=asc")
    $raices2 = @($rc2.Json | ForEach-Object { $_.tarea.titulo })
    Verificar "recomendacion: prioridad asc" (($raices2 -join "|") -eq "smoke-rc-W atrasada|smoke-rc-X sin fecha|smoke-rc-M madre") ($raices2 -join "|")
    $rc3 = Llamar "GET" ($Base + "/recomendacion?fecha=" + $limite + $filtro + "&orden=antiguedad&sentido=desc")
    $raices3 = @($rc3.Json | ForEach-Object { $_.tarea.titulo })
    Verificar "recomendacion: antiguedad desc (la mas antigua primero)" (($raices3 -join "|") -eq "smoke-rc-M madre|smoke-rc-X sin fecha|smoke-rc-W atrasada") ($raices3 -join "|")
    $rc4 = Llamar "GET" ($Base + "/recomendacion?fecha=" + $limite + $filtro + "&orden=antiguedad&sentido=asc")
    $raices4 = @($rc4.Json | ForEach-Object { $_.tarea.titulo })
    Verificar "recomendacion: antiguedad asc (la mas reciente primero)" (($raices4 -join "|") -eq "smoke-rc-W atrasada|smoke-rc-M madre|smoke-rc-X sin fecha") ($raices4 -join "|")
    $rc5 = Llamar "GET" ($Base + "/recomendacion?fecha=" + $limite + $filtro + "&limite=2")
    $raices5 = @($rc5.Json | ForEach-Object { $_.tarea.titulo })
    Verificar "recomendacion: limite=2 corta despues de ordenar" (($raices5 -join "|") -eq "smoke-rc-M madre|smoke-rc-X sin fecha") ($raices5 -join "|")
    $rc6 = Llamar "GET" ($Base + "/recomendacion")
    Verificar "recomendacion sin fecha -> 400" ($rc6.Status -eq 400) "status $($rc6.Status)"
    $rc7 = Llamar "GET" ($Base + "/recomendacion?fecha=" + $limite + "&orden=raro")
    Verificar "recomendacion con orden invalido -> 400" ($rc7.Status -eq 400) "status $($rc7.Status)"
    $rc8 = Llamar "GET" ($Base + "/recomendacion?fecha=" + $limite + "&sentido=raro")
    Verificar "recomendacion con sentido invalido -> 400" ($rc8.Status -eq 400) "status $($rc8.Status)"
    $rc9 = Llamar "GET" ($Base + "/recomendacion?fecha=" + $limite + "&limite=0")
    Verificar "recomendacion con limite 0 -> 400" ($rc9.Status -eq 400) "status $($rc9.Status)"

    # --- Agendar una tarea con sus subtareas (PATCH /{id}/agendar) ---
    # Fechas en 2098 para no tocar tareas reales. hoy = 2098-06-01; se agenda para 2098-07-01.
    # Arbol: M (atrasada, con horas) -> H1 (sin fecha) -> N (sin fecha)
    #                                -> H2 (atrasada)
    #                                -> H3 (futura, se respeta) -> G (sin fecha: no se alcanza)
    #                                -> H4 (hecha, no se toca)
    $hoyAg = "2098-06-01"
    $nuevaAg = "2098-07-01"
    function NuevaAg($json) {
        $r = Llamar "POST" $Base $json
        if (-not $r.Json) { throw "No se pudo crear la tarea de agendar: $json" }
        $script:ids += $r.Json.id
        return $r.Json.id
    }
    $agM = NuevaAg '{"titulo":"smoke-ag-M madre","prioridad":"ALTA","fecha":"2098-01-01","horaInicio":"09:00","horaFin":"10:00"}'
    $agH1 = NuevaAg ('{"titulo":"smoke-ag-H1 sin fecha","prioridad":"MEDIA","padreId":' + $agM + '}')
    $agN = NuevaAg ('{"titulo":"smoke-ag-N nieta","padreId":' + $agH1 + '}')
    $agH2 = NuevaAg ('{"titulo":"smoke-ag-H2 atrasada","prioridad":"BAJA","fecha":"2098-02-01","padreId":' + $agM + '}')
    $agH3 = NuevaAg ('{"titulo":"smoke-ag-H3 futura","fecha":"2098-12-01","padreId":' + $agM + '}')
    $agG = NuevaAg ('{"titulo":"smoke-ag-G bajo la futura","padreId":' + $agH3 + '}')
    $agH4 = NuevaAg ('{"titulo":"smoke-ag-H4 hecha","estado":"HECHO","fecha":"2098-02-02","padreId":' + $agM + '}')

    function AplanarAg($nodos) {
        foreach ($n in @($nodos)) { $n.tarea.id; AplanarAg $n.subtareas }
    }
    $vista = Llamar "GET" ($Base + "/recomendacion?fecha=" + $hoyAg + "&limite=200")
    $raizM = @($vista.Json | Where-Object { $_.tarea.id -eq $agM })[0]
    $esperadoAg = @($agM) + @(AplanarAg $raizM.subtareas)
    Verificar "agendar: la vista previa anida H1, N y H2 bajo M (no H3, G ni H4)" ((($esperadoAg | Sort-Object) -join ",") -eq ((@($agM, $agH1, $agN, $agH2) | Sort-Object) -join ",")) ($esperadoAg -join ",")

    $ag1 = Llamar "PATCH" ($Base + "/" + $agM + "/agendar") ('{"fecha":"' + $nuevaAg + '","hoy":"' + $hoyAg + '"}')
    $devueltas = @($ag1.Json | ForEach-Object { $_.id })
    Verificar "agendar -> 200 con la madre primero y lo mismo que la vista previa" (($ag1.Status -eq 200) -and (($devueltas -join ",") -eq ($esperadoAg -join ","))) "status $($ag1.Status) ids $($devueltas -join ',') esperado $($esperadoAg -join ',')"
    $m = (Llamar "GET" ($Base + "/" + $agM)).Json
    Verificar "agendar: la madre atrasada cambia de fecha, pierde las horas y suma 1" (($m.fecha -eq $nuevaAg) -and (-not $m.horaInicio) -and (-not $m.horaFin) -and ($m.vecesPospuesta -eq 1) -and ($m.estado -eq "PENDIENTE")) ($m | ConvertTo-Json -Compress)
    $h1 = (Llamar "GET" ($Base + "/" + $agH1)).Json
    Verificar "agendar: la hija sin fecha se agenda y NO suma veces_pospuesta" (($h1.fecha -eq $nuevaAg) -and ($h1.vecesPospuesta -eq 0)) ($h1 | ConvertTo-Json -Compress)
    $nn = (Llamar "GET" ($Base + "/" + $agN)).Json
    Verificar "agendar: la nieta sin fecha se agenda sin sumar" (($nn.fecha -eq $nuevaAg) -and ($nn.vecesPospuesta -eq 0)) ($nn | ConvertTo-Json -Compress)
    $h2 = (Llamar "GET" ($Base + "/" + $agH2)).Json
    Verificar "agendar: la hija atrasada se agenda y suma 1" (($h2.fecha -eq $nuevaAg) -and ($h2.vecesPospuesta -eq 1)) ($h2 | ConvertTo-Json -Compress)
    $h3 = (Llamar "GET" ($Base + "/" + $agH3)).Json
    $gg = (Llamar "GET" ($Base + "/" + $agG)).Json
    Verificar "agendar: la hija futura se respeta y no se baja a traves de ella" (($h3.fecha -eq "2098-12-01") -and (-not $gg.fecha)) "H3 $($h3.fecha) G $($gg.fecha)"
    $h4 = (Llamar "GET" ($Base + "/" + $agH4)).Json
    Verificar "agendar: la hija hecha no se toca" (($h4.fecha -eq "2098-02-02") -and ($h4.estado -eq "HECHO") -and ($h4.vecesPospuesta -eq 0)) ($h4 | ConvertTo-Json -Compress)

    # incluirSubtareas=false: solo la madre, aunque tenga una hija candidata.
    $agS = NuevaAg '{"titulo":"smoke-ag-S madre sola"}'
    $agSh = NuevaAg ('{"titulo":"smoke-ag-S1 hija","padreId":' + $agS + '}')
    $ag2 = Llamar "PATCH" ($Base + "/" + $agS + "/agendar") ('{"fecha":"' + $nuevaAg + '","hoy":"' + $hoyAg + '","incluirSubtareas":false}')
    $s1 = (Llamar "GET" ($Base + "/" + $agSh)).Json
    Verificar "agendar con incluirSubtareas=false mueve solo la madre" (($ag2.Status -eq 200) -and (@($ag2.Json).Count -eq 1) -and (-not $s1.fecha)) "status $($ag2.Status) hija $($s1.fecha)"

    $ag3 = Llamar "PATCH" ($Base + "/" + $agS + "/agendar") ('{"fecha":"2098-05-31","hoy":"' + $hoyAg + '"}')
    Verificar "agendar con fecha < hoy -> 400" ($ag3.Status -eq 400) "status $($ag3.Status)"
    $ag4 = Llamar "PATCH" ($Base + "/" + $agS + "/agendar") ('{"fecha":"' + $nuevaAg + '"}')
    Verificar "agendar sin hoy -> 400" ($ag4.Status -eq 400) "status $($ag4.Status)"
    $ag5 = Llamar "PATCH" ($Base + "/" + $agS + "/agendar") ('{"hoy":"' + $hoyAg + '"}')
    Verificar "agendar sin fecha -> 400" ($ag5.Status -eq 400) "status $($ag5.Status)"
    $ag6 = Llamar "PATCH" ($Base + "/999999/agendar") ('{"fecha":"' + $nuevaAg + '","hoy":"' + $hoyAg + '"}')
    Verificar "agendar inexistente -> 404" ($ag6.Status -eq 404) "status $($ag6.Status)"
    $ag7 = Llamar "PATCH" ($Base + "/" + $agH4 + "/agendar") ('{"fecha":"' + $nuevaAg + '","hoy":"' + $hoyAg + '"}')
    Verificar "agendar una tarea hecha -> 409" ($ag7.Status -eq 409) "status $($ag7.Status)"

    # --- Ciclos en la jerarquia de tareas ---
    $ja = Llamar "POST" $Base '{"titulo":"smoke-ja A"}'
    if ($ja.Json) { $ids += $ja.Json.id }
    if (-not $ja.Json) { throw "No se pudo crear la tarea A de jerarquia." }
    $jb = Llamar "POST" $Base ('{"titulo":"smoke-ja B","padreId":' + $ja.Json.id + '}')
    if ($jb.Json) { $ids += $jb.Json.id }
    if (-not $jb.Json) { throw "No se pudo crear la tarea B de jerarquia." }
    $jc = Llamar "POST" $Base ('{"titulo":"smoke-ja C","padreId":' + $jb.Json.id + '}')
    if ($jc.Json) { $ids += $jc.Json.id }
    if (-not $jc.Json) { throw "No se pudo crear la tarea C de jerarquia." }
    $j1 = Llamar "PUT" ($Base + "/" + $ja.Json.id) ('{"titulo":"smoke-ja A","padreId":' + $jb.Json.id + '}')
    Verificar "tarea: A bajo su hija B (A->B->A) -> 400" (($j1.Status -eq 400) -and ($j1.Raw -match "Ciclo")) "status $($j1.Status) $($j1.Raw)"
    $j2 = Llamar "PUT" ($Base + "/" + $ja.Json.id) ('{"titulo":"smoke-ja A","padreId":' + $jc.Json.id + '}')
    Verificar "tarea: A bajo su nieta C (ciclo indirecto) -> 400" (($j2.Status -eq 400) -and ($j2.Raw -match "Ciclo")) "status $($j2.Status) $($j2.Raw)"
    $j3 = Llamar "PUT" ($Base + "/" + $ja.Json.id) ('{"titulo":"smoke-ja A","padreId":' + $ja.Json.id + '}')
    Verificar "tarea: A como su propio padre -> 400" (($j3.Status -eq 400) -and ($j3.Raw -match "propio padre")) "status $($j3.Status) $($j3.Raw)"
    $j4 = Llamar "PUT" ($Base + "/" + $jc.Json.id) ('{"titulo":"smoke-ja C","padreId":' + $ja.Json.id + '}')
    Verificar "tarea: subir C bajo A (valido) -> 200" (($j4.Status -eq 200) -and ($j4.Json.padreId -eq $ja.Json.id)) "status $($j4.Status)"

    # --- Borrar una tarea con subtareas -> 409 (sin cascada desde la API) ---
    # Ahora A tiene dos hijas: B y C.
    $k1 = Llamar "DELETE" ($Base + "/" + $ja.Json.id)
    Verificar "borrar tarea con subtareas -> 409 (subtareas)" (($k1.Status -eq 409) -and ($k1.Raw -match "subtareas")) "status $($k1.Status) $($k1.Raw)"
    $k2 = Llamar "GET" ($Base + "/" + $jb.Json.id)
    Verificar "las subtareas siguen existiendo tras el 409" ($k2.Status -eq 200) "status $($k2.Status)"
    $k3 = Llamar "DELETE" ($Base + "/" + $jb.Json.id)
    Verificar "borrar una subtarea (hoja) -> 204" ($k3.Status -eq 204) "status $($k3.Status)"
    $k4 = Llamar "DELETE" ($Base + "/" + $ja.Json.id)
    Verificar "borrar tarea que aun tiene una subtarea -> 409" ($k4.Status -eq 409) "status $($k4.Status)"
    $k5 = Llamar "DELETE" ($Base + "/" + $jc.Json.id)
    Verificar "borrar la ultima subtarea -> 204" ($k5.Status -eq 204) "status $($k5.Status)"
    $k6 = Llamar "DELETE" ($Base + "/" + $ja.Json.id)
    Verificar "borrar la tarea ya sin subtareas -> 204" ($k6.Status -eq 204) "status $($k6.Status)"

    # --- Borrar una tarea con subtareas eligiendo que pasa con ellas (?subtareas=borrar|conservar) ---
    # Los cuerpos se envian como bytes UTF-8 (si no, PowerShell 5.1 manda las tildes en otra codificacion).
    # El archivo se mantiene en ASCII: la tilde se arma con [char]. La respuesta de error tambien llega mal decodificada
    # en PS 5.1, asi que el mensaje se comprueba solo en su parte ASCII.
    $titSeccion = "smoke-bs Estudiar secci" + [char]0x00F3 + "n"
    function NuevaBs($titulo, $padre = $null) {
        $json = '{"titulo":"' + $titulo + '"'
        if ($padre) { $json += ',"padreId":' + $padre }
        $json += '}'
        $r = Llamar "POST" $Base ([System.Text.Encoding]::UTF8.GetBytes($json))
        if (-not $r.Json) { throw "No se pudo crear la tarea '$titulo' ($($r.Status) $($r.Raw))" }
        $script:ids += $r.Json.id
        return $r.Json.id
    }

    # Con abuelo: X -> Y -> (Z, W). Se borra Y y sus hijas suben a X.
    $bsX = NuevaBs "smoke-bs X abuelo"
    $bsY = NuevaBs $titSeccion $bsX
    $bsZ = NuevaBs "smoke-bs Z hija" $bsY
    $bsW = NuevaBs "smoke-bs W hija" $bsY
    $bsV = NuevaBs "smoke-bs V nieta" $bsZ
    $bs1 = Llamar "DELETE" ($Base + "/" + $bsY)
    Verificar "borrar tarea con subtareas sin parametro -> 409 con el titulo" (($bs1.Status -eq 409) -and ($bs1.Raw -match "Estudiar secci") -and ($bs1.Raw -match "tiene subtareas: indica")) "status $($bs1.Status) $($bs1.Raw)"
    $bs2 = Llamar "DELETE" ($Base + "/" + $bsY + "?subtareas=")
    Verificar "?subtareas= vacio se trata como ausente -> 409" ($bs2.Status -eq 409) "status $($bs2.Status)"
    $bs3 = Llamar "DELETE" ($Base + "/" + $bsY + "?subtareas=raro")
    Verificar "?subtareas=raro -> 400 con los valores validos" (($bs3.Status -eq 400) -and ($bs3.Raw -match "borrar o conservar")) "status $($bs3.Status) $($bs3.Raw)"
    $bs4 = Llamar "GET" ($Base + "/" + $bsY)
    Verificar "tras el 409 y el 400 la tarea y su rama siguen existiendo" (($bs4.Status -eq 200) -and ((Llamar "GET" ($Base + "/" + $bsZ)).Status -eq 200)) "status $($bs4.Status)"
    $bs5 = Llamar "DELETE" ($Base + "/" + $bsY + "?subtareas=Conservar")
    Verificar "borrar Y con ?subtareas=Conservar -> 204" ($bs5.Status -eq 204) "status $($bs5.Status) $($bs5.Raw)"
    Verificar "Y ya no existe" ((Llamar "GET" ($Base + "/" + $bsY)).Status -eq 404)
    $bsZg = Llamar "GET" ($Base + "/" + $bsZ)
    $bsWg = Llamar "GET" ($Base + "/" + $bsW)
    $bsVg = Llamar "GET" ($Base + "/" + $bsV)
    Verificar "conservar con abuelo: Z (hija) sobrevive y pasa a colgar de X" (($bsZg.Status -eq 200) -and ($bsZg.Json.padreId -eq $bsX)) "status $($bsZg.Status) $($bsZg.Raw)"
    Verificar "conservar con abuelo: W (hija) sobrevive y pasa a colgar de X" (($bsWg.Status -eq 200) -and ($bsWg.Json.padreId -eq $bsX)) "status $($bsWg.Status) $($bsWg.Raw)"
    Verificar "conservar: la nieta V sigue bajo Z, sin tocarse" (($bsVg.Status -eq 200) -and ($bsVg.Json.padreId -eq $bsZ) -and ($bsVg.Json.estado -eq "PENDIENTE")) "status $($bsVg.Status) $($bsVg.Raw)"

    # Sin padre: P -> Q -> R. Se borra P conservando: Q queda raiz, R sigue bajo Q.
    $bsP = NuevaBs "smoke-bs P raiz"
    $bsQ = NuevaBs "smoke-bs Q hija" $bsP
    $bsR = NuevaBs "smoke-bs R nieta" $bsQ
    $bs6 = Llamar "DELETE" ($Base + "/" + $bsP + "?subtareas=CONSERVAR")
    Verificar "conservar sin padre -> 204" ($bs6.Status -eq 204) "status $($bs6.Status) $($bs6.Raw)"
    $bsQg = Llamar "GET" ($Base + "/" + $bsQ)
    $bsRg = Llamar "GET" ($Base + "/" + $bsR)
    Verificar "conservar sin padre: Q sobrevive y queda sin madre" (($bsQg.Status -eq 200) -and ($null -eq $bsQg.Json.padreId)) "status $($bsQg.Status) $($bsQg.Raw)"
    Verificar "conservar sin padre: R sigue bajo Q" (($bsRg.Status -eq 200) -and ($bsRg.Json.padreId -eq $bsQ)) "status $($bsRg.Status) $($bsRg.Raw)"

    # Borrar la rama completa, con un recordatorio en un descendiente: A -> (B -> C, D), recordatorio en C.
    $bsA = NuevaBs "smoke-bs A rama"
    $bsB = NuevaBs "smoke-bs B hija" $bsA
    $bsC = NuevaBs "smoke-bs C nieta" $bsB
    $bsD = NuevaBs "smoke-bs D hija" $bsA
    $bsRec = Llamar "POST" $BaseRecordatorios ('{"tareaId":' + $bsC + ',"fechaHora":"2098-05-01T09:00:00-03:00"}')
    if ($bsRec.Json) { $recordatorioIds += $bsRec.Json.id }
    Verificar "crear recordatorio en la nieta C" ($bsRec.Status -eq 201) "status $($bsRec.Status) $($bsRec.Raw)"
    $bs7 = Llamar "DELETE" ($Base + "/" + $bsA + "?subtareas=borrar")
    Verificar "borrar A con ?subtareas=borrar -> 204" ($bs7.Status -eq 204) "status $($bs7.Status) $($bs7.Raw)"
    $bsGone = @($bsA, $bsB, $bsC, $bsD) | ForEach-Object { (Llamar "GET" ($Base + "/" + $_)).Status }
    Verificar "borrar: A, B, C y D ya no existen (404)" ((($bsGone | Where-Object { $_ -ne 404 }).Count) -eq 0) ($bsGone -join ",")
    $bsRl = Llamar "GET" ($BaseRecordatorios + "?tareaId=" + $bsC)
    Verificar "borrar: el recordatorio de la nieta desaparece (GET ?tareaId= vacio)" (($bsRl.Status -eq 200) -and (@($bsRl.Json).Count -eq 0)) "status $($bsRl.Status) $($bsRl.Raw)"
    $bsXg = Llamar "GET" ($Base + "/" + $bsX)
    Verificar "borrar no toca tareas ajenas a la rama (X sigue)" ($bsXg.Status -eq 200) "status $($bsXg.Status)"

    # Una tarea sin subtareas se borra igual con o sin parametro; una inexistente es 404 con parametro.
    $bsE = NuevaBs "smoke-bs E hoja"
    $bs8 = Llamar "DELETE" ($Base + "/" + $bsE + "?subtareas=borrar")
    Verificar "tarea sin subtareas con ?subtareas=borrar -> 204" ($bs8.Status -eq 204) "status $($bs8.Status)"
    $bs9 = Llamar "DELETE" ($Base + "/999999?subtareas=conservar")
    Verificar "tarea inexistente con ?subtareas=conservar -> 404" ($bs9.Status -eq 404) "status $($bs9.Status)"

    # --- Ideas: libres o ligadas a un proyecto/objetivo, concluir/reabrir y 409 al borrar ---
    $ip = Llamar "POST" $BaseProyectos '{"nombre":"smoke-id-P"}'
    if ($ip.Json) { $proyectoIds += $ip.Json.id }
    if (-not $ip.Json) { throw "No se pudo crear el proyecto de ideas." }
    $io = Llamar "POST" $BaseObjetivos '{"nombre":"smoke-id-O"}'
    if ($io.Json) { $objetivoIds += $io.Json.id }
    if (-not $io.Json) { throw "No se pudo crear el objetivo de ideas." }

    $i1 = Llamar "POST" $BaseIdeas '{"titulo":"smoke-id-1 libre"}'
    Verificar "crear idea libre: 201, PLANTEADA, descripcion vacia y fechaCreacion con valor" (($i1.Status -eq 201) -and ($i1.Json.estado -eq "PLANTEADA") -and ($i1.Json.descripcion -eq "") -and ($i1.Json.fechaCreacion) -and (-not $i1.Json.fechaCierre) -and (-not $i1.Json.proyectoId) -and (-not $i1.Json.objetivoId)) $i1.Raw
    if ($i1.Json) { $ideaIds += $i1.Json.id }
    if (-not $i1.Json) { throw "No se pudo crear la idea libre." }
    $i2 = Llamar "POST" $BaseIdeas ('{"titulo":"smoke-id-2 de proyecto","descripcion":"detalle","proyectoId":' + $ip.Json.id + '}')
    Verificar "crear idea ligada a un proyecto" (($i2.Status -eq 201) -and ($i2.Json.proyectoId -eq $ip.Json.id) -and ($i2.Json.descripcion -eq "detalle")) $i2.Raw
    if ($i2.Json) { $ideaIds += $i2.Json.id }
    if (-not $i2.Json) { throw "No se pudo crear la idea del proyecto." }
    $i3 = Llamar "POST" $BaseIdeas ('{"titulo":"smoke-id-3 de objetivo","objetivoId":' + $io.Json.id + '}')
    Verificar "crear idea ligada a un objetivo" (($i3.Status -eq 201) -and ($i3.Json.objetivoId -eq $io.Json.id)) $i3.Raw
    if ($i3.Json) { $ideaIds += $i3.Json.id }
    if (-not $i3.Json) { throw "No se pudo crear la idea del objetivo." }
    $i4 = Llamar "POST" $BaseIdeas ('{"titulo":"smoke-id-4 de proyecto, mas nueva","proyectoId":' + $ip.Json.id + '}')
    if ($i4.Json) { $ideaIds += $i4.Json.id }
    if (-not $i4.Json) { throw "No se pudo crear la segunda idea del proyecto." }

    $ie1 = Llamar "POST" $BaseIdeas ('{"titulo":"smoke-id-x","proyectoId":' + $ip.Json.id + ',"objetivoId":' + $io.Json.id + '}')
    Verificar "crear idea con proyecto y objetivo a la vez -> 400" ($ie1.Status -eq 400) "status $($ie1.Status)"
    if ($ie1.Json -and $ie1.Json.id) { $ideaIds += $ie1.Json.id }
    $ie2 = Llamar "POST" $BaseIdeas '{"titulo":"smoke-id-x","proyectoId":999999}'
    Verificar "crear idea con proyectoId inexistente -> 400 'El proyecto no existe'" (($ie2.Status -eq 400) -and ($ie2.Raw -match "El proyecto no existe: 999999")) "status $($ie2.Status) $($ie2.Raw)"
    $ie3 = Llamar "POST" $BaseIdeas '{"titulo":"smoke-id-x","objetivoId":999999}'
    Verificar "crear idea con objetivoId inexistente -> 400 'El objetivo no existe'" (($ie3.Status -eq 400) -and ($ie3.Raw -match "El objetivo no existe: 999999")) "status $($ie3.Status) $($ie3.Raw)"
    $ie4 = Llamar "POST" $BaseIdeas '{"titulo":""}'
    Verificar "crear idea sin titulo -> 400" ($ie4.Status -eq 400) "status $($ie4.Status)"
    $ie5 = Llamar "GET" ($BaseIdeas + "/999999")
    Verificar "idea inexistente -> 404" ($ie5.Status -eq 404) "status $($ie5.Status)"

    # Filtros y orden (creacion descendente, luego id descendente)
    $il1 = Llamar "GET" ($BaseIdeas + "?proyectoId=" + $ip.Json.id)
    $il1t = @($il1.Json | ForEach-Object { $_.titulo })
    Verificar "listar ideas por proyectoId: la mas nueva primero" (($il1.Status -eq 200) -and (($il1t -join "|") -eq "smoke-id-4 de proyecto, mas nueva|smoke-id-2 de proyecto")) ($il1t -join "|")
    $il2 = Llamar "GET" ($BaseIdeas + "?objetivoId=" + $io.Json.id)
    $il2t = @($il2.Json | ForEach-Object { $_.titulo })
    Verificar "listar ideas por objetivoId" (($il2.Status -eq 200) -and (($il2t -join "|") -eq "smoke-id-3 de objetivo")) ($il2t -join "|")
    $il3 = Llamar "GET" ($BaseIdeas + "?libres=true")
    $il3t = @($il3.Json | ForEach-Object { $_.titulo })
    Verificar "listar ideas libres: trae la libre y no las ligadas" (($il3.Status -eq 200) -and ($il3t -contains "smoke-id-1 libre") -and ($il3t -notcontains "smoke-id-2 de proyecto") -and ($il3t -notcontains "smoke-id-3 de objetivo")) ($il3t -join "|")
    $il4 = Llamar "GET" ($BaseIdeas + "?libres=true&proyectoId=" + $ip.Json.id)
    Verificar "libres=true con proyectoId -> 400" ($il4.Status -eq 400) "status $($il4.Status)"
    $il5 = Llamar "GET" ($BaseIdeas + "?libres=true&objetivoId=" + $io.Json.id)
    Verificar "libres=true con objetivoId -> 400" ($il5.Status -eq 400) "status $($il5.Status)"
    $il6 = Llamar "GET" ($BaseIdeas + "?estado=RARO")
    Verificar "listar con estado invalido -> 400 con mensaje claro" (($il6.Status -eq 400) -and ($il6.Raw -match "estado") -and ($il6.Raw -match "PLANTEADA")) "status $($il6.Status) $($il6.Raw)"
    $il7 = Llamar "GET" ($BaseIdeas + "?estado=CONCLUIDA&proyectoId=" + $ip.Json.id)
    Verificar "listar CONCLUIDAS del proyecto: aun ninguna" (($il7.Status -eq 200) -and (@($il7.Json).Count -eq 0)) $il7.Raw

    # Editar (PUT no cambia el estado)
    $iu = Llamar "PUT" ($BaseIdeas + "/" + $i1.Json.id) ('{"titulo":"smoke-id-1 editada","descripcion":"nueva","proyectoId":' + $ip.Json.id + '}')
    Verificar "editar idea: pasa de libre a ligada al proyecto" (($iu.Status -eq 200) -and ($iu.Json.titulo -eq "smoke-id-1 editada") -and ($iu.Json.proyectoId -eq $ip.Json.id) -and ($iu.Json.estado -eq "PLANTEADA")) $iu.Raw
    $iu2 = Llamar "PUT" ($BaseIdeas + "/" + $i1.Json.id) ('{"titulo":"smoke-id-1 libre"}')
    Verificar "editar idea: soltar el vinculo la deja libre" (($iu2.Status -eq 200) -and (-not $iu2.Json.proyectoId)) $iu2.Raw
    $iu3 = Llamar "PUT" ($BaseIdeas + "/999999") '{"titulo":"x"}'
    Verificar "editar idea inexistente -> 404" ($iu3.Status -eq 404) "status $($iu3.Status)"

    # Concluir / reabrir
    $c1 = Llamar "PATCH" ($BaseIdeas + "/" + $i2.Json.id + "/concluir")
    Verificar "concluir sin body -> 200, CONCLUIDA, con fechaCierre" (($c1.Status -eq 200) -and ($c1.Json.estado -eq "CONCLUIDA") -and ($c1.Json.fechaCierre) -and (-not $c1.Json.conclusion)) $c1.Raw
    $c2 = Llamar "PATCH" ($BaseIdeas + "/" + $i2.Json.id + "/concluir") '{"conclusion":"otra"}'
    Verificar "concluir una ya concluida -> 409" ($c2.Status -eq 409) "status $($c2.Status)"
    $cl = Llamar "GET" ($BaseIdeas + "?estado=CONCLUIDA&proyectoId=" + $ip.Json.id)
    Verificar "listar CONCLUIDAS del proyecto: trae la concluida" (($cl.Status -eq 200) -and (@($cl.Json).Count -eq 1) -and (@($cl.Json)[0].id -eq $i2.Json.id)) $cl.Raw
    $r1 = Llamar "PATCH" ($BaseIdeas + "/" + $i2.Json.id + "/reabrir")
    Verificar "reabrir -> PLANTEADA sin fechaCierre" (($r1.Status -eq 200) -and ($r1.Json.estado -eq "PLANTEADA") -and (-not $r1.Json.fechaCierre)) $r1.Raw
    $r2 = Llamar "PATCH" ($BaseIdeas + "/" + $i2.Json.id + "/reabrir")
    Verificar "reabrir una ya planteada (idempotente)" (($r2.Status -eq 200) -and ($r2.Json.estado -eq "PLANTEADA")) $r2.Raw
    $c3 = Llamar "PATCH" ($BaseIdeas + "/" + $i2.Json.id + "/concluir") '{"conclusion":"Se hace asi"}'
    Verificar "concluir con conclusion la guarda" (($c3.Status -eq 200) -and ($c3.Json.conclusion -eq "Se hace asi")) $c3.Raw
    $r3 = Llamar "PATCH" ($BaseIdeas + "/" + $i2.Json.id + "/reabrir")
    Verificar "reabrir conserva la conclusion" (($r3.Status -eq 200) -and ($r3.Json.conclusion -eq "Se hace asi")) $r3.Raw
    $c4 = Llamar "PATCH" ($BaseIdeas + "/" + $i2.Json.id + "/concluir") '{"conclusion":""}'
    Verificar "concluir con conclusion vacia conserva la anterior" (($c4.Status -eq 200) -and ($c4.Json.conclusion -eq "Se hace asi")) $c4.Raw
    [void](Llamar "PATCH" ($BaseIdeas + "/" + $i2.Json.id + "/reabrir"))
    $c5 = Llamar "PATCH" ($BaseIdeas + "/" + $i2.Json.id + "/concluir") '{"conclusion":"Mejor asi"}'
    Verificar "concluir con conclusion nueva reemplaza la anterior" (($c5.Status -eq 200) -and ($c5.Json.conclusion -eq "Mejor asi")) $c5.Raw
    $c6 = Llamar "PATCH" ($BaseIdeas + "/999999/concluir")
    Verificar "concluir inexistente -> 404" ($c6.Status -eq 404) "status $($c6.Status)"
    $c7 = Llamar "PATCH" ($BaseIdeas + "/999999/reabrir")
    Verificar "reabrir inexistente -> 404" ($c7.Status -eq 404) "status $($c7.Status)"

    # Borrar un proyecto / objetivo con ideas -> 409; sin ideas -> 204
    $dp1 = Llamar "DELETE" ($BaseProyectos + "/" + $ip.Json.id)
    Verificar "borrar proyecto con ideas -> 409 (ideas)" (($dp1.Status -eq 409) -and ($dp1.Raw -match "ideas")) "status $($dp1.Status) $($dp1.Raw)"
    $do1 = Llamar "DELETE" ($BaseObjetivos + "/" + $io.Json.id)
    Verificar "borrar objetivo con ideas -> 409 (ideas)" (($do1.Status -eq 409) -and ($do1.Raw -match "ideas")) "status $($do1.Status) $($do1.Raw)"
    $dv = Llamar "GET" ($BaseIdeas + "/" + $i2.Json.id)
    Verificar "las ideas siguen existiendo tras el 409" ($dv.Status -eq 200) "status $($dv.Status)"
    foreach ($x in @($i2, $i3, $i4)) { [void](Llamar "DELETE" ($BaseIdeas + "/" + $x.Json.id)) }
    $di = Llamar "DELETE" ($BaseIdeas + "/" + $i1.Json.id)
    Verificar "borrar idea -> 204" ($di.Status -eq 204) "status $($di.Status)"
    $di2 = Llamar "DELETE" ($BaseIdeas + "/" + $i1.Json.id)
    Verificar "borrar idea ya borrada -> 404" ($di2.Status -eq 404) "status $($di2.Status)"
    $dp2 = Llamar "DELETE" ($BaseProyectos + "/" + $ip.Json.id)
    Verificar "borrar proyecto sin ideas -> 204" ($dp2.Status -eq 204) "status $($dp2.Status)"
    $do2 = Llamar "DELETE" ($BaseObjetivos + "/" + $io.Json.id)
    Verificar "borrar objetivo sin ideas -> 204" ($do2.Status -eq 204) "status $($do2.Status)"

    # --- Eventos: CRUD, PUT completo, solapamiento con rango y validaciones ---
    # Fechas en 2098 con desfase -03:00 para no mezclarse con eventos reales. Los limites abiertos (sin desde
    # y/o sin hasta) tambien traen eventos reales del usuario: se verifica por ids propios, nunca por tamaño.
    function Inst($v) {
        # Compara instantes (UTC), no cadenas: el desfase de la respuesta depende de la zona de la JVM.
        if ($v -is [DateTime]) { return $v.ToUniversalTime() }
        return [DateTimeOffset]::Parse([string]$v).UtcDateTime
    }
    function IdsEv($resp) { return @($resp.Json | ForEach-Object { $_.id }) }
    function NuevoEv($json) {
        $r = Llamar "POST" $BaseEventos $json
        if (-not $r.Json) { throw "No se pudo crear el evento de prueba: $json $($r.Raw)" }
        $script:eventoIds += $r.Json.id
        return $r
    }

    $evA = NuevoEv '{"titulo":"smoke-ev-A en el dia","descripcion":"d","fechaHoraInicio":"2098-03-10T10:00:00-03:00","fechaHoraFin":"2098-03-10T11:00:00-03:00","prioridad":"ALTA"}'
    Verificar "crear evento: 201 con todos los campos" (($evA.Status -eq 201) -and ($evA.Json.titulo -eq "smoke-ev-A en el dia") -and ($evA.Json.descripcion -eq "d") -and ($evA.Json.prioridad -eq "ALTA") -and ((Inst $evA.Json.fechaHoraInicio) -eq [DateTimeOffset]::Parse("2098-03-10T13:00:00Z").UtcDateTime) -and ((Inst $evA.Json.fechaHoraFin) -eq [DateTimeOffset]::Parse("2098-03-10T14:00:00Z").UtcDateTime)) $evA.Raw
    $evB = NuevoEv '{"titulo":"smoke-ev-B cruza medianoche","fechaHoraInicio":"2098-03-10T23:00:00-03:00","fechaHoraFin":"2098-03-11T01:00:00-03:00"}'
    Verificar "crear evento sin opcionales: descripcion vacia y prioridad null" (($evB.Status -eq 201) -and ($evB.Json.descripcion -eq "") -and (-not $evB.Json.prioridad)) $evB.Raw
    $evC = NuevoEv '{"titulo":"smoke-ev-C termina en desde","fechaHoraInicio":"2098-03-09T22:00:00-03:00","fechaHoraFin":"2098-03-10T00:00:00-03:00"}'
    $evD = NuevoEv '{"titulo":"smoke-ev-D empieza en hasta","fechaHoraInicio":"2098-03-11T00:00:00-03:00","fechaHoraFin":"2098-03-11T01:00:00-03:00"}'

    $evG = Llamar "GET" ($BaseEventos + "/" + $evA.Json.id)
    Verificar "obtener evento por id" (($evG.Status -eq 200) -and ($evG.Json.id -eq $evA.Json.id) -and ($evG.Json.titulo -eq "smoke-ev-A en el dia")) $evG.Raw

    # Rango del dia 2098-03-10 (-03:00): entran A y B; C termina justo en desde y D empieza justo en hasta: no entran.
    $d10 = "desde=2098-03-10T00:00:00-03:00"
    $h10 = "hasta=2098-03-11T00:00:00-03:00"
    $l1 = IdsEv (Llamar "GET" ($BaseEventos + "?" + $d10 + "&" + $h10))
    Verificar "eventos del dia: entran A y B; no C (termina en desde) ni D (empieza en hasta)" (($l1 -contains $evA.Json.id) -and ($l1 -contains $evB.Json.id) -and ($l1 -notcontains $evC.Json.id) -and ($l1 -notcontains $evD.Json.id)) ($l1 -join ",")
    $l2 = IdsEv (Llamar "GET" ($BaseEventos + "?desde=2098-03-11T00:00:00-03:00&hasta=2098-03-12T00:00:00-03:00"))
    Verificar "el evento que cruza la medianoche entra tambien en el dia siguiente (con D, sin A)" (($l2 -contains $evB.Json.id) -and ($l2 -contains $evD.Json.id) -and ($l2 -notcontains $evA.Json.id) -and ($l2 -notcontains $evC.Json.id)) ($l2 -join ",")
    # El mismo instante escrito con otro desfase (+03:00 con el + codificado como %2B) da el mismo resultado.
    $l3 = IdsEv (Llamar "GET" ($BaseEventos + "?desde=2098-03-10T06:00:00%2B03:00&hasta=2098-03-11T06:00:00%2B03:00"))
    Verificar "el rango se evalua por instantes: mismo dia escrito con desfase +03:00" ((($l3 -join ",") -eq ($l1 -join ",")) -and ($l3 -contains $evA.Json.id)) ($l3 -join ",")
    $l4 = IdsEv (Llamar "GET" ($BaseEventos + "?" + $d10))
    Verificar "solo desde: trae A, B y D; no C" (($l4 -contains $evA.Json.id) -and ($l4 -contains $evB.Json.id) -and ($l4 -contains $evD.Json.id) -and ($l4 -notcontains $evC.Json.id)) ($l4 -join ",")
    $l5 = IdsEv (Llamar "GET" ($BaseEventos + "?" + $h10))
    Verificar "solo hasta: trae C, A y B; no D" (($l5 -contains $evC.Json.id) -and ($l5 -contains $evA.Json.id) -and ($l5 -contains $evB.Json.id) -and ($l5 -notcontains $evD.Json.id)) ($l5 -join ",")
    $l6 = IdsEv (Llamar "GET" $BaseEventos)
    Verificar "sin desde ni hasta: trae los cuatro (y quiza eventos reales)" (($l6 -contains $evA.Json.id) -and ($l6 -contains $evB.Json.id) -and ($l6 -contains $evC.Json.id) -and ($l6 -contains $evD.Json.id)) ($l6 -join ",")
    $mios = @($evA.Json.id, $evB.Json.id, $evC.Json.id, $evD.Json.id)
    $l7 = @(IdsEv (Llamar "GET" ($BaseEventos + "?desde=2098-03-09T00:00:00-03:00&hasta=2098-03-12T00:00:00-03:00")) | Where-Object { $mios -contains $_ })
    Verificar "orden por inicio ascendente" (($l7 -join ",") -eq (@($evC.Json.id, $evA.Json.id, $evB.Json.id, $evD.Json.id) -join ",")) ($l7 -join ",")

    # Errores de listado
    $le1 = Llamar "GET" ($BaseEventos + "?desde=2098-03-10T00:00:00-03:00&hasta=2098-03-10T00:00:00-03:00")
    Verificar "hasta igual a desde -> 400" ($le1.Status -eq 400) "status $($le1.Status)"
    $le2 = Llamar "GET" ($BaseEventos + "?desde=2098-03-11T00:00:00-03:00&hasta=2098-03-10T00:00:00-03:00")
    Verificar "hasta anterior a desde -> 400" ($le2.Status -eq 400) "status $($le2.Status)"
    $le3 = Llamar "GET" ($BaseEventos + "?desde=abc")
    Verificar "desde mal formado -> 400" (($le3.Status -eq 400) -and ($le3.Raw -match "desde")) "status $($le3.Status) $($le3.Raw)"
    $le4 = Llamar "GET" ($BaseEventos + "?hasta=2098-03-10")
    Verificar "hasta sin hora ni desfase -> 400" (($le4.Status -eq 400) -and ($le4.Raw -match "hasta")) "status $($le4.Status) $($le4.Raw)"

    # Validaciones al crear
    $ve1 = Llamar "POST" $BaseEventos '{"titulo":"smoke-ev-x","fechaHoraInicio":"2098-03-10T10:00:00-03:00","fechaHoraFin":"2098-03-10T10:00:00-03:00"}'
    Verificar "crear con fin igual al inicio -> 400" ($ve1.Status -eq 400) "status $($ve1.Status)"
    $ve2 = Llamar "POST" $BaseEventos '{"titulo":"smoke-ev-x","fechaHoraInicio":"2098-03-10T10:00:00-03:00","fechaHoraFin":"2098-03-10T09:00:00-03:00"}'
    Verificar "crear con fin anterior al inicio -> 400" ($ve2.Status -eq 400) "status $($ve2.Status)"
    # 10:00-03:00 = 13:00Z; el fin 15:00+05:00 = 10:00Z es anterior aunque "15" > "10" como texto.
    $ve3 = Llamar "POST" $BaseEventos '{"titulo":"smoke-ev-x","fechaHoraInicio":"2098-03-10T10:00:00-03:00","fechaHoraFin":"2098-03-10T15:00:00+05:00"}'
    Verificar "el fin se compara por instantes, no por el reloj de cada desfase -> 400" ($ve3.Status -eq 400) "status $($ve3.Status)"
    $ve4 = Llamar "POST" $BaseEventos '{"titulo":"","fechaHoraInicio":"2098-03-10T10:00:00-03:00","fechaHoraFin":"2098-03-10T11:00:00-03:00"}'
    Verificar "crear con titulo vacio -> 400" ($ve4.Status -eq 400) "status $($ve4.Status)"
    $ve5 = Llamar "POST" $BaseEventos ('{"titulo":"' + ("x" * 201) + '","fechaHoraInicio":"2098-03-10T10:00:00-03:00","fechaHoraFin":"2098-03-10T11:00:00-03:00"}')
    Verificar "crear con titulo de mas de 200 caracteres -> 400" ($ve5.Status -eq 400) "status $($ve5.Status)"
    $ve6 = Llamar "POST" $BaseEventos '{"titulo":"smoke-ev-x"}'
    Verificar "crear sin fechas -> 400" ($ve6.Status -eq 400) "status $($ve6.Status)"
    $ve7 = Llamar "POST" $BaseEventos '{"titulo":"smoke-ev-x","fechaHoraInicio":"10/03/2098","fechaHoraFin":"2098-03-10T11:00:00-03:00"}'
    Verificar "crear con fecha mal formada -> 400" ($ve7.Status -eq 400) "status $($ve7.Status)"
    foreach ($x in @($ve1, $ve2, $ve3, $ve4, $ve5, $ve6, $ve7)) { if ($x.Json -and $x.Json.id) { $eventoIds += $x.Json.id } }

    # PUT = reemplazo completo: lo opcional que no viene queda vacio / null
    $eu1 = Llamar "PUT" ($BaseEventos + "/" + $evA.Json.id) '{"titulo":"smoke-ev-A editado","fechaHoraInicio":"2098-03-10T14:00:00-03:00","fechaHoraFin":"2098-03-10T15:00:00-03:00"}'
    Verificar "PUT completo: descripcion queda vacia, prioridad null y cambian las fechas" (($eu1.Status -eq 200) -and ($eu1.Json.titulo -eq "smoke-ev-A editado") -and ($eu1.Json.descripcion -eq "") -and (-not $eu1.Json.prioridad) -and ((Inst $eu1.Json.fechaHoraInicio) -eq [DateTimeOffset]::Parse("2098-03-10T17:00:00Z").UtcDateTime)) $eu1.Raw
    $eu2 = Llamar "PUT" ($BaseEventos + "/" + $evA.Json.id) '{"titulo":"smoke-ev-A editado","fechaHoraInicio":"2098-03-10T14:00:00-03:00","fechaHoraFin":"2098-03-10T13:00:00-03:00"}'
    Verificar "PUT con fin anterior al inicio -> 400" ($eu2.Status -eq 400) "status $($eu2.Status)"
    $eu3 = Llamar "PUT" ("$BaseEventos/999999") '{"titulo":"x","fechaHoraInicio":"2098-03-10T14:00:00-03:00","fechaHoraFin":"2098-03-10T15:00:00-03:00"}'
    Verificar "PUT de evento inexistente -> 404" ($eu3.Status -eq 404) "status $($eu3.Status)"
    $eg = Llamar "GET" ($BaseEventos + "/999999")
    Verificar "evento inexistente -> 404" ($eg.Status -eq 404) "status $($eg.Status)"

    # Borrar (sin 409: ningun modulo depende de un evento hoy)
    $ed1 = Llamar "DELETE" ($BaseEventos + "/" + $evA.Json.id)
    Verificar "borrar evento -> 204" ($ed1.Status -eq 204) "status $($ed1.Status)"
    $ed2 = Llamar "GET" ($BaseEventos + "/" + $evA.Json.id)
    Verificar "el evento borrado ya no existe -> 404" ($ed2.Status -eq 404) "status $($ed2.Status)"
    $ed3 = Llamar "DELETE" ($BaseEventos + "/" + $evA.Json.id)
    Verificar "borrar evento ya borrado -> 404" ($ed3.Status -eq 404) "status $($ed3.Status)"

    # --- Recordatorios: de tarea, de evento o sueltos; vencidos, PUT, marcar-enviado y cascada ---
    # Fechas en 2098 con desfase -03:00. Las listas sin filtro de tarea/evento tambien traen recordatorios reales
    # del usuario: se verifica por ids propios, nunca por tamaño.
    function IdsRec($resp) { return @($resp.Json | ForEach-Object { $_.id }) }
    function NuevoRec($json) {
        $r = Llamar "POST" $BaseRecordatorios $json
        if (-not $r.Json) { throw "No se pudo crear el recordatorio de prueba: $json $($r.Raw)" }
        $script:recordatorioIds += $r.Json.id
        return $r
    }

    $rtT = Llamar "POST" $Base '{"titulo":"smoke-rec tarea"}'
    if ($rtT.Json) { $ids += $rtT.Json.id }
    if (-not $rtT.Json) { throw "No se pudo crear la tarea de recordatorios." }
    $rtE = Llamar "POST" $BaseEventos '{"titulo":"smoke-rec evento","fechaHoraInicio":"2098-04-10T15:00:00-03:00","fechaHoraFin":"2098-04-10T16:00:00-03:00"}'
    if ($rtE.Json) { $eventoIds += $rtE.Json.id }
    if (-not $rtE.Json) { throw "No se pudo crear el evento de recordatorios." }

    $rc1 = NuevoRec ('{"tareaId":' + $rtT.Json.id + ',"fechaHora":"2098-04-10T09:00:00-03:00","descripcion":"avisar tarea"}')
    Verificar "crear recordatorio de una tarea: 201, APP, enviado false" (($rc1.Status -eq 201) -and ($rc1.Json.tareaId -eq $rtT.Json.id) -and (-not $rc1.Json.eventoId) -and ($rc1.Json.canal -eq "APP") -and ($rc1.Json.enviado -eq $false) -and ($rc1.Json.descripcion -eq "avisar tarea") -and ((Inst $rc1.Json.fechaHora) -eq [DateTimeOffset]::Parse("2098-04-10T12:00:00Z").UtcDateTime)) $rc1.Raw
    $rc2 = NuevoRec ('{"eventoId":' + $rtE.Json.id + ',"fechaHora":"2098-04-10T10:00:00-03:00"}')
    Verificar "crear recordatorio de un evento: descripcion vacia" (($rc2.Status -eq 201) -and ($rc2.Json.eventoId -eq $rtE.Json.id) -and ($rc2.Json.descripcion -eq "")) $rc2.Raw
    $rc3 = NuevoRec '{"fechaHora":"2098-04-10T11:00:00-03:00","canal":"APP","descripcion":"smoke-rec suelto"}'
    Verificar "crear recordatorio suelto con descripcion" (($rc3.Status -eq 201) -and (-not $rc3.Json.tareaId) -and (-not $rc3.Json.eventoId)) $rc3.Raw

    # Validaciones al crear
    $rv = @()
    $rv += , (Llamar "POST" $BaseRecordatorios ('{"tareaId":' + $rtT.Json.id + ',"eventoId":' + $rtE.Json.id + ',"fechaHora":"2098-04-10T09:00:00-03:00"}'))
    Verificar "crear con tarea y evento a la vez -> 400" ($rv[0].Status -eq 400) "status $($rv[0].Status)"
    $rv += , (Llamar "POST" $BaseRecordatorios '{"tareaId":999999,"fechaHora":"2098-04-10T09:00:00-03:00"}')
    Verificar "crear con tareaId inexistente -> 400 'La tarea no existe'" (($rv[1].Status -eq 400) -and ($rv[1].Raw -match "La tarea no existe: 999999")) "status $($rv[1].Status) $($rv[1].Raw)"
    $rv += , (Llamar "POST" $BaseRecordatorios '{"eventoId":999999,"fechaHora":"2098-04-10T09:00:00-03:00"}')
    Verificar "crear con eventoId inexistente -> 400 'El evento no existe'" (($rv[2].Status -eq 400) -and ($rv[2].Raw -match "El evento no existe: 999999")) "status $($rv[2].Status) $($rv[2].Raw)"
    $rv += , (Llamar "POST" $BaseRecordatorios '{"fechaHora":"2098-04-10T09:00:00-03:00"}')
    Verificar "crear suelto sin descripcion -> 400" ($rv[3].Status -eq 400) "status $($rv[3].Status)"
    $rv += , (Llamar "POST" $BaseRecordatorios '{"fechaHora":"2098-04-10T09:00:00-03:00","descripcion":"   "}')
    Verificar "crear suelto con descripcion en blanco -> 400" ($rv[4].Status -eq 400) "status $($rv[4].Status)"
    $rv += , (Llamar "POST" $BaseRecordatorios '{"fechaHora":"2098-04-10T09:00:00-03:00","canal":"CORREO","descripcion":"x"}')
    Verificar "canal CORREO -> 400 (todavia no disponible)" (($rv[5].Status -eq 400) -and ($rv[5].Raw -match "todav")) "status $($rv[5].Status) $($rv[5].Raw)"
    $rv += , (Llamar "POST" $BaseRecordatorios '{"fechaHora":"2098-04-10T09:00:00-03:00","canal":"raro","descripcion":"x"}')
    Verificar "canal inexistente -> 400 con los valores validos" (($rv[6].Status -eq 400) -and ($rv[6].Raw -match "canal") -and ($rv[6].Raw -match "APP")) "status $($rv[6].Status) $($rv[6].Raw)"
    $rv += , (Llamar "POST" $BaseRecordatorios '{"descripcion":"x"}')
    Verificar "crear sin fechaHora -> 400" ($rv[7].Status -eq 400) "status $($rv[7].Status)"
    $rv += , (Llamar "POST" $BaseRecordatorios '{"fechaHora":"10/04/2098","descripcion":"x"}')
    Verificar "crear con fechaHora mal formada -> 400" ($rv[8].Status -eq 400) "status $($rv[8].Status)"
    $rv += , (Llamar "POST" $BaseRecordatorios ('{"tareaId":' + $rtT.Json.id + ',"fechaHora":"2098-04-11T09:00:00-03:00"}'))
    Verificar "segunda vez para la misma tarea -> 409" (($rv[9].Status -eq 409) -and ($rv[9].Raw -match "ya tiene")) "status $($rv[9].Status) $($rv[9].Raw)"
    $rv += , (Llamar "POST" $BaseRecordatorios ('{"eventoId":' + $rtE.Json.id + ',"fechaHora":"2098-04-11T09:00:00-03:00"}'))
    Verificar "segunda vez para el mismo evento -> 409" (($rv[10].Status -eq 409) -and ($rv[10].Raw -match "ya tiene")) "status $($rv[10].Status) $($rv[10].Raw)"
    foreach ($x in $rv) { if ($x.Json -and $x.Json.id) { $recordatorioIds += $x.Json.id } }

    # Obtener y listar
    $rg = Llamar "GET" ($BaseRecordatorios + "/" + $rc1.Json.id)
    Verificar "obtener recordatorio por id" (($rg.Status -eq 200) -and ($rg.Json.id -eq $rc1.Json.id)) $rg.Raw
    $rl1 = IdsRec (Llamar "GET" ($BaseRecordatorios + "?tareaId=" + $rtT.Json.id))
    Verificar "listar por tareaId: solo el de la tarea" (($rl1 -join ",") -eq [string]$rc1.Json.id) ($rl1 -join ",")
    $rl2 = IdsRec (Llamar "GET" ($BaseRecordatorios + "?eventoId=" + $rtE.Json.id))
    Verificar "listar por eventoId: solo el del evento" (($rl2 -join ",") -eq [string]$rc2.Json.id) ($rl2 -join ",")
    $rl3 = Llamar "GET" ($BaseRecordatorios + "?tareaId=" + $rtT.Json.id + "&eventoId=" + $rtE.Json.id)
    Verificar "listar con tareaId y eventoId a la vez: vacio" (($rl3.Status -eq 200) -and (@($rl3.Json).Count -eq 0)) $rl3.Raw
    $rlt = IdsRec (Llamar "GET" $BaseRecordatorios)
    $mios = @($rc1.Json.id, $rc2.Json.id, $rc3.Json.id)
    $rlp = @($rlt | Where-Object { $mios -contains $_ })
    Verificar "listar sin filtros: los tres propios, ordenados por fechaHora" (($rlp -join ",") -eq ($mios -join ",")) ($rlp -join ",")
    $rl4 = Llamar "GET" ($BaseRecordatorios + "?tareaId=abc")
    Verificar "tareaId mal formado -> 400" ($rl4.Status -eq 400) "status $($rl4.Status)"
    $rl5 = Llamar "GET" ($BaseRecordatorios + "/999999")
    Verificar "recordatorio inexistente -> 404" ($rl5.Status -eq 404) "status $($rl5.Status)"

    # Vencidos (ahora lo manda el cliente): enviado = false y fechaHora <= ahora
    $rvv1 = IdsRec (Llamar "GET" ($BaseRecordatorios + "/vencidos?ahora=2098-04-10T10:00:00-03:00"))
    Verificar "vencidos: fechaHora == ahora entra (R1 y R2), el de las 11:00 no" (($rvv1 -contains $rc1.Json.id) -and ($rvv1 -contains $rc2.Json.id) -and ($rvv1 -notcontains $rc3.Json.id)) ($rvv1 -join ",")
    $rvv2 = IdsRec (Llamar "GET" ($BaseRecordatorios + "/vencidos?ahora=2098-04-10T09:59:59-03:00"))
    Verificar "vencidos: un instante antes de las 10:00 no entra R2" (($rvv2 -contains $rc1.Json.id) -and ($rvv2 -notcontains $rc2.Json.id)) ($rvv2 -join ",")
    $rvv3 = IdsRec (Llamar "GET" ($BaseRecordatorios + "/vencidos?ahora=2098-04-10T15:00:00%2B03:00"))
    Verificar "vencidos: se evalua por instantes (15:00+03:00 = 09:00-03:00, entra R1 y no R2)" (($rvv3 -contains $rc1.Json.id) -and ($rvv3 -notcontains $rc2.Json.id)) ($rvv3 -join ",")
    $rvv4 = @(IdsRec (Llamar "GET" ($BaseRecordatorios + "/vencidos?ahora=2098-04-10T12:00:00-03:00")) | Where-Object { $mios -contains $_ })
    Verificar "vencidos: orden por fechaHora" (($rvv4 -join ",") -eq ($mios -join ",")) ($rvv4 -join ",")
    $rve1 = Llamar "GET" ($BaseRecordatorios + "/vencidos")
    Verificar "vencidos sin ahora -> 400" ($rve1.Status -eq 400) "status $($rve1.Status)"
    $rve2 = Llamar "GET" ($BaseRecordatorios + "/vencidos?ahora=abc")
    Verificar "vencidos con ahora mal formado -> 400" ($rve2.Status -eq 400) "status $($rve2.Status)"

    # Marcar enviado (idempotente) y su efecto en vencidos
    $rm1 = Llamar "PATCH" ($BaseRecordatorios + "/" + $rc1.Json.id + "/marcar-enviado")
    Verificar "marcar-enviado -> enviado true" (($rm1.Status -eq 200) -and ($rm1.Json.enviado -eq $true)) $rm1.Raw
    $rm2 = Llamar "PATCH" ($BaseRecordatorios + "/" + $rc1.Json.id + "/marcar-enviado")
    Verificar "marcar-enviado otra vez (idempotente)" (($rm2.Status -eq 200) -and ($rm2.Json.enviado -eq $true)) $rm2.Raw
    $rvv5 = IdsRec (Llamar "GET" ($BaseRecordatorios + "/vencidos?ahora=2098-04-10T12:00:00-03:00"))
    Verificar "un recordatorio enviado ya no sale en vencidos" (($rvv5 -notcontains $rc1.Json.id) -and ($rvv5 -contains $rc2.Json.id)) ($rvv5 -join ",")
    $rm3 = Llamar "PATCH" ($BaseRecordatorios + "/999999/marcar-enviado")
    Verificar "marcar-enviado inexistente -> 404" ($rm3.Status -eq 404) "status $($rm3.Status)"

    # PUT = reemplazo completo. R1 esta enviado.
    $ru1 = Llamar "PUT" ($BaseRecordatorios + "/" + $rc1.Json.id) ('{"tareaId":' + $rtT.Json.id + ',"fechaHora":"2098-04-10T12:00:00Z"}')
    Verificar "PUT sin cambiar la fecha (mismo instante, otro desfase) ni el vinculo: 200, conserva enviado y descripcion vacia" (($ru1.Status -eq 200) -and ($ru1.Json.enviado -eq $true) -and ($ru1.Json.descripcion -eq "")) $ru1.Raw
    $ru2 = Llamar "PUT" ($BaseRecordatorios + "/" + $rc1.Json.id) ('{"tareaId":' + $rtT.Json.id + ',"fechaHora":"2098-04-10T13:00:00-03:00","descripcion":"movido"}')
    Verificar "PUT que cambia fechaHora: enviado vuelve a false" (($ru2.Status -eq 200) -and ($ru2.Json.enviado -eq $false) -and ($ru2.Json.descripcion -eq "movido")) $ru2.Raw
    $ru3 = Llamar "PUT" ($BaseRecordatorios + "/" + $rc3.Json.id) ('{"eventoId":' + $rtE.Json.id + ',"fechaHora":"2098-04-10T11:00:00-03:00"}')
    Verificar "PUT que cambia a un evento que ya tiene recordatorio -> 409" ($ru3.Status -eq 409) "status $($ru3.Status) $($ru3.Raw)"
    $ru4 = Llamar "PUT" ($BaseRecordatorios + "/" + $rc3.Json.id) ('{"tareaId":' + $rtT.Json.id + ',"fechaHora":"2098-04-10T11:00:00-03:00"}')
    Verificar "PUT que cambia a una tarea que ya tiene recordatorio -> 409" ($ru4.Status -eq 409) "status $($ru4.Status) $($ru4.Raw)"
    $ru5 = Llamar "PUT" ($BaseRecordatorios + "/" + $rc3.Json.id) '{"fechaHora":"2098-04-10T11:00:00-03:00"}'
    Verificar "PUT de un suelto sin descripcion -> 400" ($ru5.Status -eq 400) "status $($ru5.Status)"
    $ru6 = Llamar "PUT" ($BaseRecordatorios + "/" + $rc3.Json.id) ('{"tareaId":' + $rtT.Json.id + ',"eventoId":' + $rtE.Json.id + ',"fechaHora":"2098-04-10T11:00:00-03:00"}')
    Verificar "PUT con tarea y evento a la vez -> 400" ($ru6.Status -eq 400) "status $($ru6.Status)"
    $ru7 = Llamar "PUT" ($BaseRecordatorios + "/999999") '{"fechaHora":"2098-04-10T11:00:00-03:00","descripcion":"x"}'
    Verificar "PUT inexistente -> 404" ($ru7.Status -eq 404) "status $($ru7.Status)"

    # Cascada: borrar la tarea o el evento borra su recordatorio (la base, ON DELETE CASCADE; sin 409)
    $cd1 = Llamar "DELETE" ($Base + "/" + $rtT.Json.id)
    Verificar "borrar la tarea con recordatorio -> 204 (sin 409)" ($cd1.Status -eq 204) "status $($cd1.Status) $($cd1.Raw)"
    $cd2 = Llamar "GET" ($BaseRecordatorios + "/" + $rc1.Json.id)
    Verificar "el recordatorio de la tarea borrada desaparece (cascada) -> 404" ($cd2.Status -eq 404) "status $($cd2.Status)"
    $cd3 = Llamar "DELETE" ($BaseEventos + "/" + $rtE.Json.id)
    Verificar "borrar el evento con recordatorio -> 204 (sin 409)" ($cd3.Status -eq 204) "status $($cd3.Status) $($cd3.Raw)"
    $cd4 = Llamar "GET" ($BaseRecordatorios + "/" + $rc2.Json.id)
    Verificar "el recordatorio del evento borrado desaparece (cascada) -> 404" ($cd4.Status -eq 404) "status $($cd4.Status)"

    # Borrar
    $rd1 = Llamar "DELETE" ($BaseRecordatorios + "/" + $rc3.Json.id)
    Verificar "borrar recordatorio -> 204" ($rd1.Status -eq 204) "status $($rd1.Status)"
    $rd2 = Llamar "DELETE" ($BaseRecordatorios + "/" + $rc3.Json.id)
    Verificar "borrar recordatorio ya borrado -> 404" ($rd2.Status -eq 404) "status $($rd2.Status)"
}
catch {
    Write-Host ("ERROR en la prueba: " + $_) -ForegroundColor Red
    $fallos++
}
finally {
    # Los recordatorios primero (los ya borrados, o borrados en cascada con su tarea/evento, dan 404 y se ignoran).
    foreach ($id in $recordatorioIds) { [void](Llamar "DELETE" ($BaseRecordatorios + "/" + $id)) }
    # Los eventos no tienen dependencias: se borran sin orden especial (los ya borrados dan 404, se ignora).
    foreach ($id in $eventoIds) { [void](Llamar "DELETE" ($BaseEventos + "/" + $id)) }
    # Las ideas primero: la API da 409 al borrar un proyecto u objetivo que todavia las tiene.
    foreach ($id in $ideaIds) { [void](Llamar "DELETE" ($BaseIdeas + "/" + $id)) }
    # Orden inverso al de creacion: las subtareas (creadas despues) se borran antes que sus madres,
    # porque la API da 409 al borrar una tarea que todavia tiene subtareas.
    [array]::Reverse($ids)
    foreach ($id in $ids) { [void](Llamar "DELETE" ($Base + "/" + $id)) }
    # Limpieza de proyectos si la prueba fallo a medias: primero se desasignan tareas (ya borradas arriba)
    # y se borran los hijos antes que los padres (orden inverso de creacion).
    [array]::Reverse($proyectoIds)
    foreach ($id in $proyectoIds) { [void](Llamar "DELETE" ($BaseProyectos + "/" + $id)) }
    # Los objetivos van al final: no se pueden borrar mientras tengan proyectos o tareas.
    [array]::Reverse($objetivoIds)
    foreach ($id in $objetivoIds) { [void](Llamar "DELETE" ($BaseObjetivos + "/" + $id)) }
    Write-Host "Datos de prueba borrados."
}

if ($fallos -eq 0) {
    Write-Host "TODO OK" -ForegroundColor Green
    exit 0
} else {
    Write-Host ("$fallos prueba(s) fallaron") -ForegroundColor Red
    exit 1
}
