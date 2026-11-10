package com.agoals.proyecto;

/**
 * El proyecto no se puede borrar porque tiene subproyectos, tareas o ideas y no se indicó qué hacer con ellos
 * (borrar o conservar): se responde 409 con el nombre del proyecto.
 */
public class ProyectoConDependenciasException extends RuntimeException {

	public ProyectoConDependenciasException(String mensaje) {
		super(mensaje);
	}
}
