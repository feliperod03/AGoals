package com.agoals.serie.dto;

import com.agoals.serie.DiaSemana;
import com.agoals.serie.Frecuencia;

import java.time.LocalDate;
import java.util.Set;

public record SerieEventoResponse(
		Long id,
		Frecuencia frecuencia,
		Set<DiaSemana> diasSemana,
		Integer intervaloSemanas,
		Integer diaMes,
		LocalDate fechaInicio,
		LocalDate hasta,
		Integer repeticiones,
		String zonaHoraria) {
}
