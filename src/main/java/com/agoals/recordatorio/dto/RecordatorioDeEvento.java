package com.agoals.recordatorio.dto;

import java.time.OffsetDateTime;

/**
 * Qué debe quedar como recordatorio de un evento (uso interno entre services, no es un cuerpo de la API).
 * {@code fechaHora} null = "sin recordatorio": se borra el pendiente, si lo hay.
 */
public record RecordatorioDeEvento(Long eventoId, OffsetDateTime fechaHora) {
}
