package com.agoals.objetivo.dto;

import com.agoals.common.Estado;
import com.agoals.common.Prioridad;

import java.time.OffsetDateTime;

public record ObjetivoResponse(
		Long id,
		String nombre,
		String descripcion,
		Estado estado,
		Prioridad prioridad,
		Long padreId,
		OffsetDateTime fechaCreacion) {
}
