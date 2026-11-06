package com.agoals.proyecto.dto;

import com.agoals.common.Estado;
import com.agoals.common.Prioridad;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ProyectoRequest(
		@NotBlank @Size(max = 150) String nombre,
		String descripcion,
		Estado estado,
		Prioridad prioridad,
		Long padreId,
		Long objetivoId) {
}
