package com.agoals.evento.dto;

import com.agoals.common.Prioridad;

import java.time.OffsetDateTime;

public record EventoResponse(
		Long id,
		String titulo,
		String descripcion,
		OffsetDateTime fechaHoraInicio,
		OffsetDateTime fechaHoraFin,
		Prioridad prioridad) {
}
