package com.agoals.idea.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record IdeaRequest(
		@NotBlank @Size(max = 200) String titulo,
		String descripcion,
		Long proyectoId,
		Long objetivoId,
		String conclusion) {
}
