package com.agoals.usuario.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * El campo se llama "clave" en el JSON; en los textos para el usuario siempre decimos "contraseña".
 * "recordarme" es opcional: si no viene, cuenta como false. El límite del email evita llenar el mapa del freno de intentos.
 */
public record LoginRequest(
		@NotBlank(message = "es obligatorio") @Size(max = 255, message = "es demasiado largo") String email,
		@NotBlank(message = "es obligatoria") String clave,
		Boolean recordarme) {

	public boolean recordar() {
		return Boolean.TRUE.equals(recordarme);
	}
}
