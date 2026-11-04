package com.agoals.tarea.dto;

import com.agoals.tarea.Estado;
import com.agoals.tarea.Prioridad;
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
