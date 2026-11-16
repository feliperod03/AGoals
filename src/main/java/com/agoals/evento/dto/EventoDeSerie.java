package com.agoals.evento.dto;

import com.agoals.common.Prioridad;

import java.time.OffsetDateTime;

/** Datos de una ocurrencia ya calculada por el módulo serie (uso interno entre services, no es un cuerpo de la API). */
public record EventoDeSerie(
		String titulo,
		String descripcion,
		OffsetDateTime fechaHoraInicio,
		OffsetDateTime fechaHoraFin,
		Prioridad prioridad) {
}
