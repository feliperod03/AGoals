package com.agoals.objetivo.dto;

import com.agoals.common.Estado;
import com.agoals.common.Prioridad;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ObjetivoRequest(
		@NotBlank @Size(max = 150) String nombre,
		String descripcion,
		Estado estado,
		Prioridad prioridad,
		Long padreId) {
}
