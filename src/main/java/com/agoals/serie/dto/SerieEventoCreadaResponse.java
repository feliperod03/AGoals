package com.agoals.serie.dto;

import com.agoals.evento.dto.EventoResponse;

import java.util.List;

/** {@code recordatoriosOmitidos}: ocurrencias cuyo recordatorio ya habría pasado (la ocurrencia sí se creó). */
public record SerieEventoCreadaResponse(
		SerieEventoResponse serie,
		List<EventoResponse> eventos,
		int recordatoriosCreados,
		int recordatoriosOmitidos) {
}
