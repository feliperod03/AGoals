package com.agoals.tarea;

/** La operación es válida en formato, pero el estado actual de la tarea no la permite (409). */
public class TareaEstadoInvalidaException extends RuntimeException {

	public TareaEstadoInvalidaException(String mensaje) {
		super(mensaje);
	}
}
