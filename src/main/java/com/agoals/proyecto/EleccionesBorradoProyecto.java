package com.agoals.proyecto;

import com.agoals.common.ModoBorrado;

/**
 * Qué hacer con cada categoría de dependencias al borrar un proyecto. Un valor null significa "sin elección":
 * si esa categoría tiene elementos, el borrado responde 409; si no los tiene, se ignora.
 */
public record EleccionesBorradoProyecto(ModoBorrado subproyectos, ModoBorrado tareas, ModoBorrado ideas) {

	/** Sin ninguna elección: el comportamiento de siempre (409 ante cualquier dependencia). */
	public static final EleccionesBorradoProyecto NINGUNA = new EleccionesBorradoProyecto(null, null, null);

	/** Convierte los query params (texto); un valor que no es borrar|conservar lanza ProyectoInvalidoException (400). */
	public static EleccionesBorradoProyecto desde(String subproyectos, String tareas, String ideas) {
		return new EleccionesBorradoProyecto(
				ModoBorrado.desde("subproyectos", subproyectos, ProyectoInvalidoException::new),
				ModoBorrado.desde("tareas", tareas, ProyectoInvalidoException::new),
				ModoBorrado.desde("ideas", ideas, ProyectoInvalidoException::new));
	}
}
