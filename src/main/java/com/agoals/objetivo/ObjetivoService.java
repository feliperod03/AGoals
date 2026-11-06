package com.agoals.objetivo;

import com.agoals.common.Estado;
import com.agoals.common.Jerarquia;
import com.agoals.objetivo.dto.ObjetivoRequest;
import com.agoals.objetivo.dto.ObjetivoResponse;
import com.agoals.proyecto.ProyectoService;
import com.agoals.tarea.TareaService;
import com.agoals.tarea.dto.TareaResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional
public class ObjetivoService {

	// La v1 no tiene login: todo pertenece al usuario creado en V2.
	static final Long USUARIO_ID = 1L;

	private final ObjetivoRepository repository;
	private final ProyectoService proyectoService;
	private final TareaService tareaService;

	// Dependencias en un solo sentido: objetivo -> proyecto, objetivo -> tarea.
	// ProyectoService valida objetivos con ObjetivoConsultaService, no con esta clase (evita el ciclo).
	public ObjetivoService(ObjetivoRepository repository, ProyectoService proyectoService,
			TareaService tareaService) {
		this.repository = repository;
		this.proyectoService = proyectoService;
		this.tareaService = tareaService;
	}

	public ObjetivoResponse crear(ObjetivoRequest request) {
		validar(request, null);
		Objetivo objetivo = new Objetivo();
		objetivo.setUsuarioId(USUARIO_ID);
		aplicar(objetivo, request);
		return aRespuesta(repository.saveAndFlush(objetivo));
	}

	@Transactional(readOnly = true)
	public ObjetivoResponse obtener(Long id) {
		return aRespuesta(buscar(id));
	}

	@Transactional(readOnly = true)
	public List<ObjetivoResponse> listar(Estado estado) {
		return repository.listar(USUARIO_ID, estado).stream()
				.map(this::aRespuesta)
				.toList();
	}

	public ObjetivoResponse actualizar(Long id, ObjetivoRequest request) {
		Objetivo objetivo = buscar(id);
		validar(request, id);
		aplicar(objetivo, request);
		return aRespuesta(repository.saveAndFlush(objetivo));
	}

	// Desde la API nunca se borra en cascada, aunque la base tenga CASCADE / SET NULL:
	// hay que vaciar el objetivo antes. Cada motivo tiene su propio mensaje.
	// (Cuando exista el módulo idea, sumar aquí el chequeo de ideas: ver docs/roadmap.md, rebanada 6.)
	public void eliminar(Long id) {
		Objetivo objetivo = buscar(id);
		if (repository.existsByPadreIdAndUsuarioId(id, USUARIO_ID)) {
			throw new ObjetivoConDependenciasException(
					"El objetivo " + id + " tiene subobjetivos: muévelos o bórralos primero");
		}
		if (proyectoService.existenProyectosDelObjetivo(id)) {
			throw new ObjetivoConDependenciasException(
					"El objetivo " + id + " tiene proyectos: cámbiales el objetivo o bórralos primero");
		}
		if (tareaService.existenTareasDelObjetivo(id)) {
			throw new ObjetivoConDependenciasException(
					"El objetivo " + id + " tiene tareas: desasígnalas primero");
		}
		repository.delete(objetivo);
	}

	// --- Tareas ligadas directamente al objetivo (los proyectos del objetivo se ven en GET /api/proyectos?objetivoId=) ---

	@Transactional(readOnly = true)
	public List<TareaResponse> listarTareas(Long id) {
		buscar(id);
		return tareaService.listarPorObjetivo(id);
	}

	/** Liga la tarea al objetivo. Si estaba en otro objetivo, la reasigna. */
	public TareaResponse asignarTarea(Long id, Long tareaId) {
		buscar(id);
		return tareaService.asignarObjetivo(tareaId, id);
	}

	public void desasignarTarea(Long id, Long tareaId) {
		buscar(id);
		TareaResponse tarea = tareaService.obtener(tareaId);
		if (!id.equals(tarea.objetivoId())) {
			throw new ObjetivoInvalidoException("La tarea " + tareaId + " no pertenece al objetivo " + id);
		}
		tareaService.asignarObjetivo(tareaId, null);
	}

	private Objetivo buscar(Long id) {
		return repository.findByIdAndUsuarioId(id, USUARIO_ID)
				.orElseThrow(() -> new ObjetivoNoEncontradoException(id));
	}

	private void validar(ObjetivoRequest r, Long idActual) {
		Jerarquia.validarPadre("objetivo", r.padreId(), idActual,
				id -> repository.findByIdAndUsuarioId(id, USUARIO_ID), Objetivo::getPadreId,
				ObjetivoInvalidoException::new);
	}

	private void aplicar(Objetivo objetivo, ObjetivoRequest r) {
		objetivo.setNombre(r.nombre());
		objetivo.setDescripcion(r.descripcion() != null ? r.descripcion() : "");
		objetivo.setEstado(r.estado() != null ? r.estado() : Estado.PENDIENTE);
		objetivo.setPrioridad(r.prioridad());
		objetivo.setPadreId(r.padreId());
	}

	private ObjetivoResponse aRespuesta(Objetivo o) {
		return new ObjetivoResponse(o.getId(), o.getNombre(), o.getDescripcion(), o.getEstado(),
				o.getPrioridad(), o.getPadreId(), o.getFechaCreacion());
	}
}
