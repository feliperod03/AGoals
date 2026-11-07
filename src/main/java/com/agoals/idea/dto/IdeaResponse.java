package com.agoals.idea.dto;

import com.agoals.idea.EstadoIdea;

import java.time.OffsetDateTime;

public record IdeaResponse(
		Long id,
		String titulo,
		String descripcion,
		EstadoIdea estado,
		String conclusion,
		Long proyectoId,
		Long objetivoId,
		OffsetDateTime fechaCreacion,
		OffsetDateTime fechaCierre) {
}
