package com.agoals.common;

/**
 * Conteo de una categoría en la vista previa del borrado (5f).
 *
 * @param total    elementos de la categoría sobre los que se elige borrar o conservar (los mismos que mira el 409)
 * @param borrados filas que desaparecen con la elección dada, incluidas las arrastradas (p. ej. subtareas sin ligar);
 *                 0 si se conserva. Puede ser mayor que {@code total}
 */
public record ConteoBorrado(int total, int borrados) {
}
