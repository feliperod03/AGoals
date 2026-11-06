package com.agoals.proyecto;

/** El proyecto no se puede borrar porque tiene subproyectos o tareas: se responde 409. */
public class ProyectoConDependenciasException extends RuntimeException {

	public ProyectoConDependenciasException(String mensaje) {
		super(mensaje);
	}
}
