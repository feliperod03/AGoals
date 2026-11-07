# Prueba de humo de la API: tareas (agenda del dia, marcar hecha, posponer), proyectos
# (jerarquia, ciclos, asignar tareas, borrado con 409) y objetivos (jerarquia, ciclos,
# proyectos y tareas ligados, borrado con 409 segun el motivo), atrasadas, reabrir y recomendacion.
# Requiere la app corriendo (docker compose up -d y .\mvnw spring-boot:run).
# Uso:  .\scripts\smoke-test.ps1
# Crea tareas con fecha 2099-12-31, y proyectos y objetivos "smoke-*", y los borra al terminar.
param(
    [string]$Base = "http://localhost:8080/api/tareas",
    [string]$BaseProyectos = "http://localhost:8080/api/proyectos",
    [string]$BaseObjetivos = "http://localhost:8080/api/objetivos"
)

$fecha = "2099-12-31"
$fallos = 0
$ids = @()
$proyectoIds = @()
$objetivoIds = @()

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
}
catch {
    Write-Host ("ERROR en la prueba: " + $_) -ForegroundColor Red
    $fallos++
}
finally {
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
