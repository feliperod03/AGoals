package com.agoals.objetivo.dto;

/**
 * Conteo de proyectos en la vista previa del borrado de un objetivo.
 *
 * @param total      proyectos ligados directamente a los objetivos que se borran
 * @param borrados   proyectos que desaparecen con {@code proyectos=borrar}: los ligados y sus subproyectos, menos los
 *                   rescatados; 0 si se conservan
 * @param rescatados subproyectos (raíces rescatadas) que se salvan por estar ligados a un objetivo que no se borra;
 *                   su sub-árbol también se salva pero no se suma
 */
public record ConteoProyectosBorrado(int total, int borrados, int rescatados) {
}
