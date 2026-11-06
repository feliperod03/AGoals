package com.agoals.tarea.dto;

import com.agoals.common.Estado;
import com.agoals.common.Prioridad;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.time.LocalTime;

public record TareaRequest(
		@NotBlank @Size(max = 200) String titulo,
		String descripcion,
		Estado estado,
		Prioridad prioridad,
		LocalDate fecha,
		LocalTime horaInicio,
		LocalTime horaFin,
		Long padreId) {
}
