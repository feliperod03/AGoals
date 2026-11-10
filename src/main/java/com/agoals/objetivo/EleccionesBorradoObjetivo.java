package com.agoals.objetivo;

import com.agoals.common.ModoBorrado;

/**
 * Qué hacer con cada categoría de dependencias al borrar un objetivo. Un valor null significa "sin elección":
 * si esa categoría tiene elementos, el borrado responde 409; si no los tiene, se ignora.
 */
public record EleccionesBorradoObjetivo(ModoBorrado subobjetivos, ModoBorrado proyectos, ModoBorrado tareas,
		ModoBorrado ideas) {

	/** Sin ninguna elección: el comportamiento de siempre (409 ante cualquier dependencia). */
	public static final EleccionesBorradoObjetivo NINGUNA = new EleccionesBorradoObjetivo(null, null, null, null);

	/** Convierte los query params (texto); un valor que no es borrar|conservar lanza ObjetivoInvalidoException (400). */
	public static EleccionesBorradoObjetivo desde(String subobjetivos, String proyectos, String tareas, String ideas) {
		return new EleccionesBorradoObjetivo(
				ModoBorrado.desde("subobjetivos", subobjetivos, ObjetivoInvalidoException::new),
				ModoBorrado.desde("proyectos", proyectos, ObjetivoInvalidoException::new),
				ModoBorrado.desde("tareas", tareas, ObjetivoInvalidoException::new),
				ModoBorrado.desde("ideas", ideas, ObjetivoInvalidoException::new));
	}
}
