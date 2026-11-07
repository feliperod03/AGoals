package com.agoals.idea;

/** Regla de negocio o combinación de datos inválida en una petición: se responde 400. */
public class IdeaInvalidaException extends RuntimeException {

	public IdeaInvalidaException(String mensaje) {
		super(mensaje);
	}
}
