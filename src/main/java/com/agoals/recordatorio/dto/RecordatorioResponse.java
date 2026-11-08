package com.agoals.recordatorio.dto;

import com.agoals.recordatorio.Canal;

import java.time.OffsetDateTime;

public record RecordatorioResponse(
		Long id,
		Long tareaId,
		Long eventoId,
		OffsetDateTime fechaHora,
		Canal canal,
		boolean enviado,
		String descripcion) {
}
