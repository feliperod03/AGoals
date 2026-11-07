package com.agoals.tarea.dto;

import java.util.List;

/** Una tarea recomendada con sus subtareas candidatas anidadas (todos los niveles). */
public record TareaRecomendadaResponse(TareaResponse tarea, List<TareaRecomendadaResponse> subtareas) {
}
