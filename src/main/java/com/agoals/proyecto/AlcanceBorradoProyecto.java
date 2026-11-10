package com.agoals.proyecto;

import java.util.List;

/**
 * Resultado de la fase 1 de {@code ProyectoService.eliminar}: todo lo que el borrado va a tocar, ya validado
 * (los 409 se lanzaron al calcularlo). La fase 2 solo escribe. La vista previa del impacto (5f) reutiliza la
 * fase 1 y lee los conteos de aquí.
 *
 * @param raiz          el proyecto pedido
 * @param hijosDirectos sus subproyectos directos
 * @param aBorrar       proyectos que se eliminan, hojas primero y la raíz al final
 * @param tareaIds      tareas ligadas a algún proyecto de {@code aBorrar} (sin contar sus subtareas)
 * @param ideaIds       ideas ligadas a algún proyecto de {@code aBorrar}
 */
record AlcanceBorradoProyecto(Proyecto raiz, List<Proyecto> hijosDirectos, List<Proyecto> aBorrar,
		EleccionesBorradoProyecto elecciones, List<Long> tareaIds, List<Long> ideaIds) {

	List<Long> idsABorrar() {
		return aBorrar.stream().map(Proyecto::getId).toList();
	}
}
