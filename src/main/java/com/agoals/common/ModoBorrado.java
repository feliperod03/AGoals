package com.agoals.common;

import java.util.Locale;
import java.util.function.Function;

/**
 * Qué hacer con una categoría de dependencias (subproyectos, tareas, ideas…) al borrar un proyecto u objetivo.
 * Sin elección (null) y con elementos en esa categoría, el borrado responde 409. Es el mismo vocabulario que
 * {@code ModoSubtareas} (5d); en la interfaz "conservar" se presenta como "mover / dejar suelto".
 */
public enum ModoBorrado {
	BORRAR, CONSERVAR;

	/**
	 * Acepta el texto del query param (sin distinguir mayúsculas ni espacios); null o vacío = sin elección (null).
	 *
	 * @param parametro nombre del parámetro, para el mensaje de error
	 * @param error     crea la excepción 400 del módulo que llama a partir del mensaje
	 */
	public static ModoBorrado desde(String parametro, String texto, Function<String, ? extends RuntimeException> error) {
		if (texto == null || texto.isBlank()) {
			return null;
		}
		return switch (texto.trim().toLowerCase(Locale.ROOT)) {
			case "borrar" -> BORRAR;
			case "conservar" -> CONSERVAR;
			default -> throw error.apply(parametro + " inválido: '" + texto + "' (use borrar o conservar)");
		};
	}
}
