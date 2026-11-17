package com.agoals.common;

import org.springframework.stereotype.Component;

/** Temporal hasta L1b: sin login, todo pertenece al usuario creado en V2. En L1b se reemplaza por la lectura de la sesión. */
@Component
public class UsuarioActualFijo implements UsuarioActual {

	@Override
	public Long id() {
		return 1L;
	}
}
