package com.agoals.proyecto;

import com.agoals.common.Estado;
import com.agoals.common.Jerarquia;
import com.agoals.proyecto.dto.ProyectoRequest;
import com.agoals.proyecto.dto.ProyectoResponse;
import com.agoals.tarea.TareaService;
import com.agoals.tarea.dto.TareaResponse;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional
public class ProyectoService {

	// La v1 no tiene login: todo pertenece al usuario creado en V2.
	static final Long USUARIO_ID = 1L;

	private final ProyectoRepository repository;
	private final TareaService tareaService;

	// Dependencia en un solo sentido: proyecto -> tarea. TareaService no conoce a ProyectoService.
	public ProyectoService(ProyectoRepository repository, TareaService tareaService) {
		this.repository = repository;
		this.tareaService = tareaService;
	}

	public ProyectoResponse crear(ProyectoRequest request) {
		validar(request, null);
		Proyecto proyecto = new Proyecto();
		proyecto.setUsuarioId(USUARIO_ID);
		aplicar(proyecto, request);
		return aRespuesta(guardar(proyecto));
	}

	@Transactional(readOnly = true)
	public ProyectoResponse obtener(Long id) {
		return aRespuesta(buscar(id));
	}

	@Transactional(readOnly = true)
	public List<ProyectoResponse> listar(Estado estado, Long objetivoId) {
		return repository.listar(USUARIO_ID, estado, objetivoId).stream()
				.map(this::aRespuesta)
				.toList();
	}

	public ProyectoResponse actualizar(Long id, ProyectoRequest request) {
		Proyecto proyecto = buscar(id);
		validar(request, id);
		aplicar(proyecto, request);
		return aRespuesta(guardar(proyecto));
	}

	// Desde la API nunca se borra en cascada, aunque la base tenga CASCADE / SET NULL:
	// hay que vaciar el proyecto (mover o quitar subproyectos y tareas) antes de borrarlo.
	public void eliminar(Long id) {
		Proyecto proyecto = buscar(id);
		if (repository.existsByPadreIdAndUsuarioId(id, USUARIO_ID)) {
			throw new ProyectoConDependenciasException(
					"El proyecto " + id + " tiene subproyectos: muévelos o bórralos primero");
		}
		if (tareaService.existenTareasDelProyecto(id)) {
			throw new ProyectoConDependenciasException(
					"El proyecto " + id + " tiene tareas: desasígnalas primero");
		}
		repository.delete(proyecto);
	}

	// --- Tareas del proyecto ---

	@Transactional(readOnly = true)
	public List<TareaResponse> listarTareas(Long id) {
		buscar(id);
		return tareaService.listarPorProyecto(id);
	}

	/** Asigna la tarea al proyecto. Si estaba en otro proyecto, la reasigna. */
	public TareaResponse asignarTarea(Long id, Long tareaId) {
		buscar(id);
		return tareaService.asignarProyecto(tareaId, id);
	}

	public void desasignarTarea(Long id, Long tareaId) {
		buscar(id);
		TareaResponse tarea = tareaService.obtener(tareaId);
		if (!id.equals(tarea.proyectoId())) {
			throw new ProyectoInvalidoException("La tarea " + tareaId + " no pertenece al proyecto " + id);
		}
		tareaService.asignarProyecto(tareaId, null);
	}

	private Proyecto buscar(Long id) {
		return repository.findByIdAndUsuarioId(id, USUARIO_ID)
				.orElseThrow(() -> new ProyectoNoEncontradoException(id));
	}

	// Hasta la 4b no existe ObjetivoService: si el objetivoId no existe, la FK de la base lo rechaza
	// y aquí se traduce a 400. saveAndFlush fuerza el INSERT/UPDATE dentro de este método.
	private Proyecto guardar(Proyecto proyecto) {
		try {
			return repository.saveAndFlush(proyecto);
		} catch (DataIntegrityViolationException e) {
			if (proyecto.getObjetivoId() != null) {
				throw new ProyectoInvalidoException("El objetivo no existe: " + proyecto.getObjetivoId());
			}
			throw e;
		}
	}

	private void validar(ProyectoRequest r, Long idActual) {
		Jerarquia.validarPadre("proyecto", r.padreId(), idActual,
				id -> repository.findByIdAndUsuarioId(id, USUARIO_ID), Proyecto::getPadreId,
				ProyectoInvalidoException::new);
	}

	private void aplicar(Proyecto proyecto, ProyectoRequest r) {
		proyecto.setNombre(r.nombre());
		proyecto.setDescripcion(r.descripcion() != null ? r.descripcion() : "");
		proyecto.setEstado(r.estado() != null ? r.estado() : Estado.PENDIENTE);
		proyecto.setPrioridad(r.prioridad());
		proyecto.setPadreId(r.padreId());
		proyecto.setObjetivoId(r.objetivoId());
	}

	private ProyectoResponse aRespuesta(Proyecto p) {
		return new ProyectoResponse(p.getId(), p.getNombre(), p.getDescripcion(), p.getEstado(),
				p.getPrioridad(), p.getPadreId(), p.getObjetivoId(), p.getFechaCreacion());
	}
}
