package com.agoals.proyecto.dto;

import com.agoals.common.ConteoBorrado;

/** Vista previa del borrado de un proyecto: qué categorías se tocan y cuántos elementos se borrarían (solo lectura). */
public record ImpactoBorradoProyectoResponse(ConteoBorrado subproyectos, ConteoBorrado tareas, ConteoBorrado ideas) {
}
