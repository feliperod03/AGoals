package com.agoals.objetivo;

import com.agoals.common.Estado;
import com.agoals.common.Jerarquia;
import com.agoals.common.ModoBorrado;
import com.agoals.idea.IdeaService;
import com.agoals.objetivo.dto.ObjetivoRequest;
import com.agoals.objetivo.dto.ObjetivoResponse;
import com.agoals.proyecto.PlanBorradoProyectos;
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
	private final IdeaService ideaService;

	// Dependencias en un solo sentido: objetivo -> proyecto, objetivo -> tarea, objetivo -> idea.
	// ProyectoService valida objetivos con ObjetivoConsultaService, no con esta clase (evita el ciclo).
	// IdeaService valida objetivos con ObjetivoConsultaService, tampoco con esta clase.
	public ObjetivoService(ObjetivoRepository repository, ProyectoService proyectoService,
			TareaService tareaService, IdeaService ideaService) {
		this.repository = repository;
		this.proyectoService = proyectoService;
		this.tareaService = tareaService;
		this.ideaService = ideaService;
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

	/**
	 * Borra el objetivo. Por cada categoría con elementos (subobjetivos, proyectos, tareas, ideas) hay que elegir
	 * {@code borrar} o {@code conservar}; sin elección es 409. Una categoría vacía ignora su elección. Todo en una
	 * transacción. Dos fases: {@link #calcularAlcance} valida y arma qué se toca (solo lectura), {@link #ejecutar} escribe.
	 *
	 * <p>Proyectos, tareas e ideas se aplican a los de CUALQUIER objetivo que se borra (el propio y, con
	 * {@code subobjetivos=borrar}, sus descendientes) y, las tareas e ideas, también a los de los proyectos que se
	 * borran. Con {@code proyectos=borrar}, un subproyecto ligado a otro objetivo que no se borra se rescata
	 * (ver {@link ProyectoService#planBorradoPorObjetivos}).
	 */
	public void eliminar(Long id, EleccionesBorradoObjetivo elecciones) {
		ejecutar(calcularAlcance(id, elecciones));
	}

	/** Fase 1, solo lectura: lanza 404/409 y devuelve todo lo que el borrado tocaría. */
	AlcanceBorradoObjetivo calcularAlcance(Long id, EleccionesBorradoObjetivo elecciones) {
		EleccionesBorradoObjetivo e = elecciones != null ? elecciones : EleccionesBorradoObjetivo.NINGUNA;
		Objetivo raiz = buscar(id);
		List<Objetivo> hijos = repository.findByPadreIdAndUsuarioId(id, USUARIO_ID);
		if (!hijos.isEmpty() && e.subobjetivos() == null) {
			throw conflicto(raiz, "subobjetivos", "borrarlos o conservarlos");
		}
		List<Objetivo> aBorrar = e.subobjetivos() == ModoBorrado.BORRAR
				? Jerarquia.hojasPrimero(List.of(raiz), Objetivo::getId,
						oid -> repository.findByPadreIdAndUsuarioId(oid, USUARIO_ID), o -> false)
				: List.of(raiz);
		List<Long> objetivoIds = aBorrar.stream().map(Objetivo::getId).toList();

		List<Long> proyectosLigados = proyectoService.idsDeObjetivos(objetivoIds);
		if (!proyectosLigados.isEmpty() && e.proyectos() == null) {
			throw conflicto(raiz, "proyectos", "borrarlos o conservarlos");
		}
		PlanBorradoProyectos plan = e.proyectos() == ModoBorrado.BORRAR && !proyectosLigados.isEmpty()
				? proyectoService.planBorradoPorObjetivos(objetivoIds)
				: PlanBorradoProyectos.VACIO;
		List<Long> desligados = e.proyectos() == ModoBorrado.CONSERVAR ? proyectosLigados : List.of();

		// Tareas e ideas de los objetivos que se borran y de los proyectos que se borran (no de los conservados ni rescatados).
		List<Long> tareaIds = tareaService.idsLigadas(plan.aBorrar(), objetivoIds);
		if (!tareaIds.isEmpty() && e.tareas() == null) {
			throw conflicto(raiz, "tareas", "borrarlas o conservarlas");
		}
		List<Long> ideaIds = ideaService.idsLigadas(plan.aBorrar(), objetivoIds);
		if (!ideaIds.isEmpty() && e.ideas() == null) {
			throw conflicto(raiz, "ideas", "borrarlas o conservarlas");
		}
		return new AlcanceBorradoObjetivo(raiz, hijos, aBorrar, plan, desligados, tareaIds, ideaIds, e);
	}

	// Fase 2. De lo más dependiente a lo menos: tareas e ideas, luego proyectos, al final la jerarquía de objetivos.
	// Si se borrara antes el proyecto o el objetivo, el SET NULL de la base soltaría tareas e ideas en silencio y ya
	// no las encontraríamos para borrarlas.
	private void ejecutar(AlcanceBorradoObjetivo a) {
		List<Long> objetivoIds = a.idsObjetivosABorrar();
		List<Long> proyectoIds = a.proyectoIdsABorrar();
		if (!a.tareaIds().isEmpty()) {
			if (a.elecciones().tareas() == ModoBorrado.BORRAR) {
				tareaService.eliminarLigadas(a.tareaIds());
			} else {
				tareaService.desligar(a.tareaIds(), proyectoIds, objetivoIds);
			}
		}
		if (!a.ideaIds().isEmpty()) {
			if (a.elecciones().ideas() == ModoBorrado.BORRAR) {
				ideaService.eliminarLigadas(a.ideaIds());
			} else {
				ideaService.desligar(a.ideaIds(), proyectoIds, objetivoIds);
			}
		}
		if (!a.proyectoIdsDesligados().isEmpty()) {
			proyectoService.desligarDeObjetivo(a.proyectoIdsDesligados());
		}
		if (!a.proyectoIdsABorrar().isEmpty()) {
			proyectoService.ejecutarBorradoPorObjetivos(a.proyectos());
		}

		if (a.elecciones().subobjetivos() == ModoBorrado.BORRAR) {
			repository.deleteAll(a.objetivosABorrar()); // hojas primero: así la cascada de la base no se adelanta
		} else {
			if (!a.hijosDirectos().isEmpty()) {
				// Primero reasignar y hacer flush: si se borrara el objetivo antes, la cascada se llevaría a los hijos.
				a.hijosDirectos().forEach(h -> h.setPadreId(a.raiz().getPadreId()));
				repository.saveAllAndFlush(a.hijosDirectos());
			}
			repository.delete(a.raiz());
		}
		repository.flush();
	}

	private static ObjetivoConDependenciasException conflicto(Objetivo o, String categoria, String acciones) {
		return new ObjetivoConDependenciasException(
				"El objetivo «" + o.getNombre() + "» tiene " + categoria + ": indica si quieres " + acciones);
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
