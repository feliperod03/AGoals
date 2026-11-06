package com.agoals.objetivo;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Consulta de solo lectura que otros módulos (hoy, proyecto) usan para validar un objetivoId.
 *
 * <p>Existe para evitar un ciclo de beans: ProyectoService necesita validar objetivos y ObjetivoService
 * necesita preguntar a ProyectoService si un objetivo tiene proyectos. Por eso esta clase usa SOLO
 * ObjetivoRepository y nunca debe depender de otro service (ni de ObjetivoService). Hay un test que lo vigila.
 */
@Service
@Transactional(readOnly = true)
public class ObjetivoConsultaService {

	private final ObjetivoRepository repository;

	public ObjetivoConsultaService(ObjetivoRepository repository) {
		this.repository = repository;
	}

	/** Lanza ObjetivoInvalidoException (400) si el objetivo no existe: sirve para validar el cuerpo de una petición. */
	public void validarExiste(Long objetivoId) {
		if (!repository.existsByIdAndUsuarioId(objetivoId, ObjetivoService.USUARIO_ID)) {
			throw new ObjetivoInvalidoException("El objetivo no existe: " + objetivoId);
		}
	}
}
