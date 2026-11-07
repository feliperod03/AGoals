package com.agoals.proyecto;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Consulta de solo lectura que otros módulos (hoy, idea) usan para validar un proyectoId.
 *
 * <p>Existe por la misma razón que ObjetivoConsultaService: IdeaService necesita validar proyectos y
 * ProyectoService necesita preguntar a IdeaService si un proyecto tiene ideas. Por eso esta clase usa SOLO
 * ProyectoRepository y nunca debe depender de otro service (ni de ProyectoService). Hay un test que lo vigila.
 */
@Service
@Transactional(readOnly = true)
public class ProyectoConsultaService {

	private final ProyectoRepository repository;

	public ProyectoConsultaService(ProyectoRepository repository) {
		this.repository = repository;
	}

	/** Lanza ProyectoInvalidoException (400) si el proyecto no existe: sirve para validar el cuerpo de una petición. */
	public void validarExiste(Long proyectoId) {
		if (!repository.existsByIdAndUsuarioId(proyectoId, ProyectoService.USUARIO_ID)) {
			throw new ProyectoInvalidoException("El proyecto no existe: " + proyectoId);
		}
	}
}
