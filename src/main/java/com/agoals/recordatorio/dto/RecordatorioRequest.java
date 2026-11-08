package com.agoals.recordatorio.dto;

import com.agoals.recordatorio.Canal;
import jakarta.validation.constraints.NotNull;

import java.time.OffsetDateTime;

public record RecordatorioRequest(
		Long tareaId,
		Long eventoId,
		@NotNull OffsetDateTime fechaHora,
		Canal canal,
		String descripcion) {
}
