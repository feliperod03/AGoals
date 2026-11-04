package com.agoals.tarea.dto;

import com.agoals.tarea.Estado;
import com.agoals.tarea.Prioridad;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;

public record TareaResponse(
		Long id,
		String titulo,
		String descripcion,
		Estado estado,
		Prioridad prioridad,
		LocalDate fecha,
		LocalTime horaInicio,
		LocalTime horaFin,
		Long padreId,
		int vecesPospuesta,
		OffsetDateTime fechaCreacion) {
}
