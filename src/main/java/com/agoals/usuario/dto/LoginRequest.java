package com.agoals.usuario.dto;

import jakarta.validation.constraints.NotBlank;

/** El campo se llama "clave" en el JSON; en los textos para el usuario siempre decimos "contraseña". */
public record LoginRequest(
		@NotBlank(message = "es obligatorio") String email,
		@NotBlank(message = "es obligatoria") String clave) {
}
