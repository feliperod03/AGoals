package com.agoals.objetivo;

/**
 * El objetivo no se puede borrar porque tiene subobjetivos, proyectos, tareas o ideas y no se indicó qué hacer con
 * ellos (borrar o conservar): se responde 409 con el nombre del objetivo.
 */
public class ObjetivoConDependenciasException extends RuntimeException {

	public ObjetivoConDependenciasException(String mensaje) {
		super(mensaje);
	}
}
