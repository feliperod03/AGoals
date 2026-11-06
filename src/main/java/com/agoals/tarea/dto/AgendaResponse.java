package com.agoals.tarea.dto;

import java.time.LocalDate;
import java.util.List;

/** Agenda de un día: tareas con hora (planificación) y tareas sueltas (lista del día). */
public record AgendaResponse(
		LocalDate fecha,
		List<TareaResponse> conHora,
		List<TareaResponse> sinHora) {
}
