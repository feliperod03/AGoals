package com.agoals.proyecto.dto;

import com.agoals.common.Estado;
import com.agoals.common.Prioridad;

import java.time.OffsetDateTime;

public record ProyectoResponse(
		Long id,
		String nombre,
		String descripcion,
		Estado estado,
		Prioridad prioridad,
		Long padreId,
		Long objetivoId,
		OffsetDateTime fechaCreacion) {
}
