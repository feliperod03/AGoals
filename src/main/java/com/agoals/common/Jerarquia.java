package com.agoals.common;

import java.util.HashSet;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;

/**
 * Reglas comunes de las entidades jerárquicas (proyecto, objetivo, tarea): el padre debe existir y no
 * puede haber ciclos. Cada módulo pasa cómo buscar un registro y qué excepción lanzar, así este helper
 * no depende de ningún módulo.
 */
public final class Jerarquia {

	private Jerarquia() {
	}

	/** Igual que la otra sobrecarga, para entidades de género masculino (proyecto, objetivo). */
	public static <T> void validarPadre(String entidad, Long padreId, Long idActual,
			Function<Long, Optional<T>> buscar, Function<T, Long> padreDe,
			Function<String, ? extends RuntimeException> error) {
		validarPadre(entidad, false, padreId, idActual, buscar, padreDe, error);
	}

	/**
	 * Valida el {@code padreId} que se quiere asignar a un registro.
	 *
	 * @param entidad   nombre para los mensajes ("proyecto", "objetivo", "tarea")
	 * @param femenino  true si la entidad es femenina ("tarea"): ajusta los artículos de los mensajes
	 * @param padreId   padre pedido (null = sin padre, siempre válido)
	 * @param idActual  id del registro que se edita, o null si se está creando
	 * @param buscar    busca un registro por id (del usuario actual)
	 * @param padreDe   obtiene el padreId de un registro
	 * @param error     crea la excepción de módulo (400) a partir del mensaje
	 */
	public static <T> void validarPadre(String entidad, boolean femenino, Long padreId, Long idActual,
			Function<Long, Optional<T>> buscar, Function<T, Long> padreDe,
			Function<String, ? extends RuntimeException> error) {
		if (padreId == null) {
			return;
		}
		String un = femenino ? "Una " : "Un ";
		String el = femenino ? "la " : "el ";
		String delA = femenino ? "de la " : "del ";
		if (padreId.equals(idActual)) {
			throw error.apply(un + entidad + " no puede ser su propio padre");
		}
		// Se sube por la cadena de padres del nuevo padre: si aparece el registro que se edita,
		// quedaría siendo su propio descendiente. El Set evita un bucle infinito ante datos ya corruptos.
		Set<Long> visitados = new HashSet<>();
		Long actual = padreId;
		while (actual != null && visitados.add(actual)) {
			if (actual.equals(idActual)) {
				throw error.apply("Ciclo en la jerarquía: " + el + entidad + " " + padreId
						+ " es descendiente " + delA + entidad + " " + idActual);
			}
			Optional<T> encontrado = buscar.apply(actual);
			if (encontrado.isEmpty()) {
				if (actual.equals(padreId)) {
					String elInicial = femenino ? "La " : "El ";
					throw error.apply(elInicial + entidad + " padre no existe: " + padreId);
				}
				break;
			}
			actual = padreDe.apply(encontrado.get());
		}
	}
}
