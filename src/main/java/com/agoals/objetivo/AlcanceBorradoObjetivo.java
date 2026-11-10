package com.agoals.objetivo;

import com.agoals.proyecto.PlanBorradoProyectos;

import java.util.List;
import java.util.Set;

/**
 * Resultado de la fase 1 de {@code ObjetivoService.eliminar}: todo lo que el borrado va a tocar, ya validado
 * (los 409 se lanzaron al calcularlo). La fase 2 solo escribe. La vista previa del impacto (5f) reutiliza la fase 1
 * y lee los conteos de aquí.
 *
 * @param raiz                   el objetivo pedido
 * @param hijosDirectos          sus subobjetivos directos
 * @param objetivosABorrar       objetivos que se eliminan, hojas primero y la raíz al final
 * @param proyectoIdsLigados     proyectos ligados directamente a algún objetivo de {@code objetivosABorrar}, se borren
 *                               o no (la fase 2 no lo usa; sirve para el total de la vista previa)
 * @param proyectos              proyectos que se eliminan (hojas primero) y rescatados con su nuevo padre; vacío si
 *                               {@code proyectos=conservar}
 * @param proyectoIdsDesligados  proyectos que se conservan y quedan sin objetivo ({@code proyectos=conservar})
 * @param tareaIds               tareas ligadas a algún objetivo o proyecto borrado (sin contar sus subtareas)
 * @param ideaIds                ideas ligadas a algún objetivo o proyecto borrado
 */
record AlcanceBorradoObjetivo(Objetivo raiz, List<Objetivo> hijosDirectos, List<Objetivo> objetivosABorrar,
		List<Long> proyectoIdsLigados, PlanBorradoProyectos proyectos, List<Long> proyectoIdsDesligados, List<Long> tareaIds, List<Long> ideaIds,
		EleccionesBorradoObjetivo elecciones) {

	List<Long> idsObjetivosABorrar() {
		return objetivosABorrar.stream().map(Objetivo::getId).toList();
	}

	List<Long> proyectoIdsABorrar() {
		return proyectos.aBorrar();
	}

	Set<Long> proyectoIdsRescatados() {
		return proyectos.rescatados().keySet();
	}
}
