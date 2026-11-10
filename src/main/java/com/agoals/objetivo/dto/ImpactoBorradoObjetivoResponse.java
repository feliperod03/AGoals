package com.agoals.objetivo.dto;

import com.agoals.common.ConteoBorrado;

/** Vista previa del borrado de un objetivo: qué categorías se tocan y cuántos elementos se borrarían (solo lectura). */
public record ImpactoBorradoObjetivoResponse(ConteoBorrado subobjetivos, ConteoProyectosBorrado proyectos,
		ConteoBorrado tareas, ConteoBorrado ideas) {
}
