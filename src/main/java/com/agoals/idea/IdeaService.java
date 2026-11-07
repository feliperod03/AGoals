package com.agoals.idea;

import com.agoals.idea.dto.ConcluirRequest;
import com.agoals.idea.dto.IdeaRequest;
import com.agoals.idea.dto.IdeaResponse;
import com.agoals.objetivo.ObjetivoConsultaService;
import com.agoals.proyecto.ProyectoConsultaService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;

@Service
@Transactional
public class IdeaService {

	// La v1 no tiene login: todo pertenece al usuario creado en V2.
	static final Long USUARIO_ID = 1L;

	private final IdeaRepository repository;
	private final ProyectoConsultaService proyectoConsultaService;
	private final ObjetivoConsultaService objetivoConsultaService;

	// Dependencias en un solo sentido: idea -> proyecto/objetivo solo a través de sus *ConsultaService,
	// que usan únicamente su repository. Así ProyectoService y ObjetivoService pueden depender de esta clase
	// (para el 409 al borrar) sin ciclos de beans.
	public IdeaService(IdeaRepository repository, ProyectoConsultaService proyectoConsultaService,
			ObjetivoConsultaService objetivoConsultaService) {
		this.repository = repository;
		this.proyectoConsultaService = proyectoConsultaService;
		this.objetivoConsultaService = objetivoConsultaService;
	}

	public IdeaResponse crear(IdeaRequest request) {
		validar(request);
		Idea idea = new Idea();
		idea.setUsuarioId(USUARIO_ID);
		aplicar(idea, request);
		return aRespuesta(repository.saveAndFlush(idea));
	}

	@Transactional(readOnly = true)
	public IdeaResponse obtener(Long id) {
		return aRespuesta(buscar(id));
	}

	@Transactional(readOnly = true)
	public List<IdeaResponse> listar(EstadoIdea estado, Long proyectoId, Long objetivoId, Boolean libres) {
		boolean soloLibres = Boolean.TRUE.equals(libres);
		if (soloLibres && (proyectoId != null || objetivoId != null)) {
			throw new IdeaInvalidaException("'libres=true' no se puede combinar con proyectoId ni objetivoId");
		}
		return repository.listar(USUARIO_ID, estado, proyectoId, objetivoId, soloLibres).stream()
				.map(this::aRespuesta)
				.toList();
	}

	/** Edita los datos de la idea en cualquier estado. No cambia el estado ni la fecha de cierre. */
	public IdeaResponse actualizar(Long id, IdeaRequest request) {
		Idea idea = buscar(id);
		validar(request);
		aplicar(idea, request);
		return aRespuesta(repository.saveAndFlush(idea));
	}

	public void eliminar(Long id) {
		repository.delete(buscar(id));
	}

	/**
	 * Pasa a CONCLUIDA con fecha_cierre = ahora. Una conclusión no vacía reemplaza a la existente;
	 * si viene vacía o no viene (request null), se conserva la anterior.
	 */
	public IdeaResponse concluir(Long id, ConcluirRequest request) {
		Idea idea = buscar(id);
		if (idea.getEstado() == EstadoIdea.CONCLUIDA) {
			throw new IdeaEstadoInvalidaException("La idea " + id + " ya está concluida");
		}
		String conclusion = request != null ? request.conclusion() : null;
		if (conclusion != null && !conclusion.isBlank()) {
			idea.setConclusion(conclusion);
		}
		idea.setEstado(EstadoIdea.CONCLUIDA);
		idea.setFechaCierre(OffsetDateTime.now());
		return aRespuesta(repository.saveAndFlush(idea));
	}

	/** Vuelve a PLANTEADA, sin fecha de cierre y conservando la conclusión. Si ya está PLANTEADA no cambia. */
	public IdeaResponse reabrir(Long id) {
		Idea idea = buscar(id);
		if (idea.getEstado() == EstadoIdea.PLANTEADA) {
			return aRespuesta(idea);
		}
		idea.setEstado(EstadoIdea.PLANTEADA);
		idea.setFechaCierre(null);
		return aRespuesta(repository.saveAndFlush(idea));
	}

	// --- Soporte para ProyectoService y ObjetivoService (409 al borrar) ---

	@Transactional(readOnly = true)
	public boolean existenIdeasDelProyecto(Long proyectoId) {
		return repository.existsByProyectoIdAndUsuarioId(proyectoId, USUARIO_ID);
	}

	@Transactional(readOnly = true)
	public boolean existenIdeasDelObjetivo(Long objetivoId) {
		return repository.existsByObjetivoIdAndUsuarioId(objetivoId, USUARIO_ID);
	}

	private Idea buscar(Long id) {
		return repository.findByIdAndUsuarioId(id, USUARIO_ID)
				.orElseThrow(() -> new IdeaNoEncontradaException(id));
	}

	private void validar(IdeaRequest r) {
		if (r.proyectoId() != null && r.objetivoId() != null) {
			throw new IdeaInvalidaException("Una idea no puede estar ligada a un proyecto y a un objetivo a la vez");
		}
		// 400 "El proyecto/objetivo no existe: N". La FK de la base queda como red de seguridad.
		if (r.proyectoId() != null) {
			proyectoConsultaService.validarExiste(r.proyectoId());
		}
		if (r.objetivoId() != null) {
			objetivoConsultaService.validarExiste(r.objetivoId());
		}
	}

	private void aplicar(Idea idea, IdeaRequest r) {
		idea.setTitulo(r.titulo());
		idea.setDescripcion(r.descripcion() != null ? r.descripcion() : "");
		idea.setProyectoId(r.proyectoId());
		idea.setObjetivoId(r.objetivoId());
		idea.setConclusion(r.conclusion() == null || r.conclusion().isBlank() ? null : r.conclusion());
	}

	private IdeaResponse aRespuesta(Idea i) {
		return new IdeaResponse(i.getId(), i.getTitulo(), i.getDescripcion(), i.getEstado(), i.getConclusion(),
				i.getProyectoId(), i.getObjetivoId(), i.getFechaCreacion(), i.getFechaCierre());
	}
}
