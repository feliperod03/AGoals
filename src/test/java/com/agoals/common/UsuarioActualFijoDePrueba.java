package com.agoals.common;

/** Solo para tests de services con rollback: siempre el usuario 1 (el de V2), sin pasar por la sesión. */
public class UsuarioActualFijoDePrueba implements UsuarioActual {

	@Override
	public Long id() {
		return 1L;
	}
}
