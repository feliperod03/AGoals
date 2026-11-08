package com.agoals.evento.dto;

import com.agoals.common.Prioridad;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.OffsetDateTime;

public record EventoRequest(
		@NotBlank @Size(max = 200) String titulo,
		String descripcion,
		@NotNull OffsetDateTime fechaHoraInicio,
		@NotNull OffsetDateTime fechaHoraFin,
		Prioridad prioridad) {
}
