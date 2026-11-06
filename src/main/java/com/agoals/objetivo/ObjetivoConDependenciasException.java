package com.agoals.objetivo;

/** El objetivo no se puede borrar porque tiene subobjetivos, proyectos o tareas: se responde 409. */
public class ObjetivoConDependenciasException extends RuntimeException {

	public ObjetivoConDependenciasException(String mensaje) {
		super(mensaje);
	}
}
