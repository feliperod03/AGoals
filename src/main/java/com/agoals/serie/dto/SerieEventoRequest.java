package com.agoals.serie.dto;

import com.agoals.common.Prioridad;
import com.agoals.serie.DiaSemana;
import com.agoals.serie.Frecuencia;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.Set;

/**
 * Crea una serie. {@code ahora} lo manda el cliente (el servidor no usa su reloj): de ahí sale "hoy" en la zona de la serie.
 * Si {@code horaFin} es menor que {@code horaInicio}, el evento termina al día siguiente; iguales (todo el día) = 400.
 */
public record SerieEventoRequest(
		@NotBlank @Size(max = 200) String titulo,
		String descripcion,
		Prioridad prioridad,
		@NotNull LocalTime horaInicio,
		@NotNull LocalTime horaFin,
		@NotBlank String zonaHoraria,
		@NotNull OffsetDateTime ahora,
		@NotNull Frecuencia frecuencia,
		Set<DiaSemana> diasSemana,
		Integer intervaloSemanas,
		Integer diaMes,
		LocalDate hasta,
		Integer repeticiones,
		@Valid RecordatorioSerieRequest recordatorio) {
}
