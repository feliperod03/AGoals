package com.agoals.idea;

/** La operación es válida en formato, pero el estado actual de la idea no la permite (409). */
public class IdeaEstadoInvalidaException extends RuntimeException {

	public IdeaEstadoInvalidaException(String mensaje) {
		super(mensaje);
	}
}
