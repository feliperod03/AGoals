package com.agoals.proyecto;

/** Regla de negocio o referencia inválida en una petición: se responde 400. */
public class ProyectoInvalidoException extends RuntimeException {

	public ProyectoInvalidoException(String mensaje) {
		super(mensaje);
	}
}
