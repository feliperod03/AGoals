package com.agoals.serie.dto;

import com.agoals.common.Prioridad;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalTime;
import java.time.OffsetDateTime;

/**
 * Edita "toda la serie" (la ocurrencia elegida y las siguientes). Reemplazo completo: {@code recordatorio} null quita los
 * recordatorios pendientes. La regla (días, intervalo, final) no se puede cambiar.
 */
public record SerieEventoEdicionRequest(
		@NotBlank @Size(max = 200) String titulo,
		String descripcion,
		Prioridad prioridad,
		@NotNull LocalTime horaInicio,
		@NotNull LocalTime horaFin,
		@NotNull OffsetDateTime ahora,
		@Valid RecordatorioSerieRequest recordatorio) {
}
