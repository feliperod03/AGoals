package com.agoals.proyecto;

import java.util.List;
import java.util.Map;

/**
 * Qué proyectos desaparecen al borrar objetivos con {@code proyectos=borrar}, y cuáles se rescatan.
 * Solo lleva ids para que ObjetivoService no maneje entidades de este módulo.
 *
 * @param aBorrar    ids a eliminar, hojas primero
 * @param rescatados id del subproyecto rescatado -> id de su nuevo padre (null = pasa a ser raíz). Un rescatado es un
 *                   subproyecto ligado a un objetivo que NO se borra, cuyo padre sí se borra: se salva con todo su
 *                   sub-árbol y sube al ancestro más cercano que sobrevive
 */
public record PlanBorradoProyectos(List<Long> aBorrar, Map<Long, Long> rescatados) {

	public static final PlanBorradoProyectos VACIO = new PlanBorradoProyectos(List.of(), Map.of());
}
