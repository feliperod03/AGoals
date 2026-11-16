package com.agoals.serie.dto;

import com.agoals.evento.dto.EventoResponse;

import java.util.List;

/** {@code eventos}: las ocurrencias modificadas. {@code recordatoriosOmitidos}: su nuevo recordatorio ya habría pasado, así que el pendiente quedó como estaba. */
public record SerieEventoEdicionResponse(
		List<EventoResponse> eventos,
		int recordatoriosOmitidos) {
}
