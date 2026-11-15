# AGoals: 20 casos de uso para la revisión de usabilidad

Guion para probar la app como la usaría Felipe. Cada caso es una historia con pasos y resultado esperado. El probador (claudito) los ejecuta uno a uno en el navegador, anota el resultado en `.playwright-mcp/hallazgos-uso.md` y NO arregla nada.

**Datos de prueba:** todo lo que se cree lleva el prefijo `ZZ-uso` (ej. «ZZ-uso comprar pan») y se borra al terminar. Los datos reales no se tocan.

**Qué observar en TODOS los casos (además del resultado esperado):**
- ¿Se entiende qué hacer sin leer nada? ¿Los textos son claros y sin jerga?
- ¿El foco del teclado va a un lugar lógico al abrir y cerrar diálogos y menús? ¿Se puede hacer todo sin mouse?
- ¿Hay avisos o errores que confundan, desaparezcan demasiado rápido o aparezcan donde no corresponde?
- ¿Algo tarda, parpadea, salta de lugar o queda cortado?
- ¿Cuántos clics cuesta lo que se hace seguido?

**Resultado de cada caso:** `OK` (sin observaciones), `HALLAZGO` (funciona pero hay algo que mejorar, o falla) o `BLOQUEADO` (no se pudo probar y por qué).

---

## A. Día a día (Hoy y tareas)

**C01. Primer vistazo a Hoy.** Entro a la app y quiero saber qué tengo hoy. Esperado: lista del día, planificación por horas con línea de «ahora», próximos 3 recordatorios y 3 eventos. Observar: ¿lo importante se ve sin hacer scroll? ¿Los estados vacíos explican qué hacer?

**C02. Anotar una idea de tarea rápida (sin fecha).** «Nueva tarea» con solo título. Esperado: se crea sin fecha y el aviso dice que está en el Cofre. Observar: ¿cuántos campos obliga a mirar? ¿El aviso se alcanza a leer?

**C03. Planificar una tarea para hoy con hora.** Crear tarea con fecha de hoy, hora de inicio y fin, prioridad alta. Esperado: aparece en la planificación por horas en el hueco correcto. Observar: validación de horas incoherentes (fin antes del inicio).

**C04. Terminar y reabrir.** Marcar hecha una tarea de Hoy y reabrirla. Si tiene recordatorio sin enviar, debe preguntar. Esperado: el estado cambia al instante y es visible. Observar: ¿se puede deshacer un clic equivocado?

**C05. Posponer con recordatorio.** Tarea con fecha y recordatorio; posponer a mañana con la casilla de mover el recordatorio marcada. Esperado: la tarea y el aviso se mueven y el aviso lo confirma. Probar también «Dejar sin fecha». Observar: ¿se entiende qué pasa con el recordatorio en cada opción?

**C06. Subtareas.** Crear una tarea madre, agregarle una subtarea nueva, vincular una tarea existente como subtarea, cambiar la madre y borrar la madre eligiendo «Conservar». Esperado: la jerarquía se refleja en Hoy y el Cofre y las subtareas conservadas suben de nivel. Observar: ¿se entiende «madre/subtarea»? ¿El diálogo de borrado explica bien las opciones?

## B. Cofre y recomendación

**C07. Encontrar una tarea en el Cofre.** Con ~8 tareas `ZZ-uso` variadas, usar búsqueda por título, accesos rápidos, «Más filtros», chips activos y «Volver a la vista por defecto». Esperado: los filtros se combinan y los chips permiten quitar cada uno. Observar: ¿se sabe siempre qué filtros están activos y por qué falta una tarea?

**C08. Armar el día con la recomendación.** Abrir «Recomendación», ordenar por prioridad y por antigüedad, filtrar por proyecto, encender «Incluir próximos 7 días» y agendar una tarea con sus subtareas para hoy. Esperado: la tarea aparece en Hoy con el aviso correcto y el diálogo sigue abierto. Observar: ¿se entiende qué sugiere y por qué?

## C. Proyectos, objetivos e ideas

**C09. Montar un objetivo con un proyecto.** Crear objetivo, crear un proyecto dentro (padre y objetivo) y un subproyecto. Esperado: el árbol se ve bien en los listados y los detalles. Observar: ¿la diferencia entre objetivo, proyecto y subproyecto es evidente?

**C10. Ligar tareas a un proyecto y a un objetivo.** Desde el menú de una tarea («Proyecto y objetivo…») ligarla a ambos, cambiar uno y quitar otro; luego, desde el detalle del proyecto, «Vincular una existente» y «Quitar». Esperado: se refleja en el detalle y en el Cofre. Observar: ¿se entiende que son vínculos independientes?

**C11. Ciclo de vida de una idea.** Crear una idea ligada a un proyecto, concluirla con una conclusión, reabrirla, filtrarla por estado y vínculo y editarla. Esperado: la conclusión se conserva al reabrir. Observar: ¿se entiende la diferencia entre planteada y concluida?

**C12. Ideas dentro del detalle de un proyecto.** Con 6 ideas ligadas a un mismo proyecto, abrir su detalle y usar «Ver todas en Ideas». Esperado: máximo 5 con «+N más» y el enlace abre `/ideas` ya filtrada. Observar: ¿el filtro aplicado se nota?

**C13. Borrar un proyecto con contenido.** Proyecto con subproyecto, tareas e ideas: abrir el borrado, alternar «Mover/Borrar» en cada categoría y confirmar. Esperado: el resumen en vivo coincide con lo que realmente desaparece. Observar: ¿da miedo o da confianza? ¿Se entiende qué se pierde?

## D. Calendario y recordatorios

**C14. Moverme por el mes.** Navegar meses, volver con «Hoy», elegir un día, mirar el panel «Detalle del día», y repetir solo con teclado (flechas, Inicio/Fin, RePág/AvPág). Esperado: la URL conserva mes y día. Observar: ¿se reconoce el día elegido? ¿El panel queda a la vista?

**C15. Ver mi semana.** Cambiar a «Semana» con un evento normal, uno nocturno que cruce la medianoche y una tarea sin hora. Esperado: bloques cortados en la medianoche y franja «Sin hora». Observar: ¿el rango horario es razonable? ¿Se ve todo sin scroll excesivo?

**C16. Crear eventos de tres maneras.** «Nuevo evento», «Agregar evento» del panel del día y clic en un hueco de la semana; uno de «Todo el día». Esperado: valores iniciales sensatos y el calendario salta al día del evento. Observar: ¿qué manera es más natural? ¿Los errores de fechas se entienden?

**C17. Mover un evento con recordatorio.** Evento con recordatorio sin enviar: cambiar su inicio con la casilla marcada y luego desmarcada. Esperado: el recordatorio conserva (o no) su distancia al inicio y el texto de la casilla muestra el instante resultante. Observar: ¿el texto de la casilla es claro?

**C18. Recordatorio vencido.** Crear un recordatorio suelto con hora ya pasada. Esperado: el banner aparece en cualquier página, «Entendido» lo marca y desaparece; sobrevive a recargar hasta pulsar «Entendido». Observar: ¿el banner estorba o se pasa por alto?

## E. Transversales

**C19. Tema claro, oscuro y sistema.** Ciclar el tema, recargar y repasar Hoy, Cofre y Calendario en oscuro. Esperado: la preferencia persiste y no hay parpadeo al cargar. Observar: contraste, íconos de fecha/hora, scroll y desplegables nativos.

**C20. Recorrido completo en móvil (390 px).** Con la ventana a 390 px de ancho: abrir el menú de navegación, crear una tarea, abrir un menú «⋯», recorrer Cofre, Proyectos, Ideas y Calendario (mes y semana) y cerrar diálogos. Esperado: todo accesible con el pulgar, sin texto cortado ni scroll horizontal. Observar: tamaño de los botones (≥ 44 px), botón «Cerrar» de los diálogos, teclado virtual tapando campos. **Esta es la base del punto «usar en móvil».**
