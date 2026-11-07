package com.agoals.tarea;

/** La tarea no se puede borrar porque tiene subtareas: se responde 409. */
public class TareaConDependenciasException extends RuntimeException {

	public TareaConDependenciasException(String mensaje) {
		super(mensaje);
	}
}
