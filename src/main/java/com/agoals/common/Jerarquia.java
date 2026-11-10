package com.agoals.common;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.function.Predicate;

/**
 * Reglas comunes de las entidades jerárquicas (proyecto, objetivo, tarea): el padre debe existir y no
 * puede haber ciclos. Cada módulo pasa cómo buscar un registro y qué excepción lanzar, así este helper
 * no depende de ningún módulo.
 */
public final class Jerarquia {

	private Jerarquia() {
	}

	/**
	 * Las {@code raices} y todos sus descendientes, en post-orden: cada hijo aparece antes que su padre. Es el orden
	 * en que hay que borrar cuando la base tiene ON DELETE CASCADE en {@code padre_id}: si se borrara primero el padre,
	 * la cascada se llevaría a los hijos y su propio DELETE afectaría 0 filas (Hibernate lanza excepción).
	 *
	 * <p>El conjunto de visitados se comparte entre todas las raíces, así que una raíz que es descendiente de otra
	 * sale una sola vez y siempre antes que su ancestro; también es la red de seguridad ante ciclos (la API los impide).
	 *
	 * @param id      id de un elemento
	 * @param hijasDe hijas directas de un id
	 * @param corta   se aplica solo a los descendientes: si es true, ese hijo no entra ni se baja por él (lo usa el
	 *                rescate de subproyectos). Las raíces siempre entran
	 */
	public static <T> List<T> hojasPrimero(Collection<T> raices, Function<T, Long> id,
			Function<Long, List<T>> hijasDe, Predicate<T> corta) {
		Set<Long> visitados = new HashSet<>();
		List<T> salida = new ArrayList<>();
		for (T raiz : raices) {
			recorrer(raiz, id, hijasDe, corta, visitados, salida);
		}
		return salida;
	}

	private static <T> void recorrer(T nodo, Function<T, Long> id, Function<Long, List<T>> hijasDe,
			Predicate<T> corta, Set<Long> visitados, List<T> salida) {
		Long idNodo = id.apply(nodo);
		if (!visitados.add(idNodo)) {
			return;
		}
		for (T hijo : hijasDe.apply(idNodo)) {
			if (!corta.test(hijo)) {
				recorrer(hijo, id, hijasDe, corta, visitados, salida);
			}
		}
		salida.add(nodo);
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
