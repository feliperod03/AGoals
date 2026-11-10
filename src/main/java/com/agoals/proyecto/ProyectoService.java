package com.agoals.proyecto;

import com.agoals.common.Estado;
import com.agoals.common.Jerarquia;
import com.agoals.common.ModoBorrado;
import com.agoals.idea.IdeaService;
import com.agoals.objetivo.ObjetivoConsultaService;
import com.agoals.proyecto.dto.ProyectoRequest;
import com.agoals.proyecto.dto.ProyectoResponse;
import com.agoals.tarea.TareaService;
import com.agoals.tarea.dto.TareaResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.function.Predicate;

@Service
@Transactional
public class ProyectoService {

	// La v1 no tiene login: todo pertenece al usuario creado en V2.
	static final Long USUARIO_ID = 1L;

	private final ProyectoRepository repository;
	private final TareaService tareaService;
	private final ObjetivoConsultaService objetivoConsultaService;
	private final IdeaService ideaService;

	// Dependencias en un solo sentido: proyecto -> tarea, proyecto -> objetivo (solo la consulta) y proyecto -> idea.
	// Se usa ObjetivoConsultaService y no ObjetivoService porque ObjetivoService depende de esta clase.
	// IdeaService valida proyectos con ProyectoConsultaService, no con esta clase (evita el ciclo).
	public ProyectoService(ProyectoRepository repository, TareaService tareaService,
			ObjetivoConsultaService objetivoConsultaService, IdeaService ideaService) {
		this.repository = repository;
		this.tareaService = tareaService;
		this.objetivoConsultaService = objetivoConsultaService;
		this.ideaService = ideaService;
	}

	public ProyectoResponse crear(ProyectoRequest request) {
		validar(request, null);
		Proyecto proyecto = new Proyecto();
		proyecto.setUsuarioId(USUARIO_ID);
		aplicar(proyecto, request);
		return aRespuesta(repository.saveAndFlush(proyecto));
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
		return aRespuesta(repository.saveAndFlush(proyecto));
	}

	/**
	 * Borra el proyecto. Por cada categoría con elementos (subproyectos, tareas, ideas) hay que elegir
	 * {@code borrar} o {@code conservar}; sin elección es 409, porque la base tiene CASCADE / SET NULL y no queremos
	 * que se lleve o suelte algo por accidente. Una categoría vacía ignora su elección. Todo en una transacción.
	 * Se hace en dos fases: {@link #calcularAlcance} valida y arma qué se toca (solo lectura) y {@link #ejecutar} escribe.
	 */
	public void eliminar(Long id, EleccionesBorradoProyecto elecciones) {
		ejecutar(calcularAlcance(id, elecciones));
	}

	/** Fase 1, solo lectura: lanza 404/409 y devuelve todo lo que el borrado tocaría. */
	AlcanceBorradoProyecto calcularAlcance(Long id, EleccionesBorradoProyecto elecciones) {
		EleccionesBorradoProyecto e = elecciones != null ? elecciones : EleccionesBorradoProyecto.NINGUNA;
		Proyecto raiz = buscar(id);
		List<Proyecto> hijos = repository.findByPadreIdAndUsuarioId(id, USUARIO_ID);
		if (!hijos.isEmpty() && e.subproyectos() == null) {
			throw conflicto(raiz, "subproyectos", "borrarlos o conservarlos");
		}
		List<Proyecto> aBorrar = e.subproyectos() == ModoBorrado.BORRAR
				? Jerarquia.hojasPrimero(List.of(raiz), Proyecto::getId,
						pid -> repository.findByPadreIdAndUsuarioId(pid, USUARIO_ID), p -> false)
				: List.of(raiz);
		List<Long> ids = aBorrar.stream().map(Proyecto::getId).toList();

		// El alcance de tareas e ideas incluye el sub-árbol cuando se borra.
		List<Long> tareaIds = tareaService.idsLigadas(ids, List.of());
		if (!tareaIds.isEmpty() && e.tareas() == null) {
			throw conflicto(raiz, "tareas", "borrarlas o conservarlas");
		}
		List<Long> ideaIds = ideaService.idsLigadas(ids, List.of());
		if (!ideaIds.isEmpty() && e.ideas() == null) {
			throw conflicto(raiz, "ideas", "borrarlas o conservarlas");
		}
		return new AlcanceBorradoProyecto(raiz, hijos, aBorrar, e, tareaIds, ideaIds);
	}

	// Fase 2. Primero lo que depende del proyecto (tareas, ideas) y al final la jerarquía: si el proyecto se borrara
	// antes, el SET NULL de la base soltaría las tareas e ideas en silencio y ya no las encontraríamos para borrarlas.
	private void ejecutar(AlcanceBorradoProyecto a) {
		List<Long> ids = a.idsABorrar();
		if (!a.tareaIds().isEmpty()) {
			if (a.elecciones().tareas() == ModoBorrado.BORRAR) {
				tareaService.eliminarLigadas(a.tareaIds());
			} else {
				tareaService.desligar(a.tareaIds(), ids, List.of());
			}
		}
		if (!a.ideaIds().isEmpty()) {
			if (a.elecciones().ideas() == ModoBorrado.BORRAR) {
				ideaService.eliminarLigadas(a.ideaIds());
			} else {
				ideaService.desligar(a.ideaIds(), ids, List.of());
			}
		}
		if (a.elecciones().subproyectos() == ModoBorrado.BORRAR) {
			repository.deleteAll(a.aBorrar()); // hojas primero: así la cascada de la base no se adelanta
		} else {
			if (!a.hijosDirectos().isEmpty()) {
				// Primero reasignar y hacer flush: si se borrara el proyecto antes, la cascada se llevaría a los hijos.
				a.hijosDirectos().forEach(h -> h.setPadreId(a.raiz().getPadreId()));
				repository.saveAllAndFlush(a.hijosDirectos());
			}
			repository.delete(a.raiz());
		}
		repository.flush();
	}

	private static ProyectoConDependenciasException conflicto(Proyecto p, String categoria, String acciones) {
		return new ProyectoConDependenciasException(
				"El proyecto «" + p.getNombre() + "» tiene " + categoria + ": indica si quieres " + acciones);
	}

	// --- Soporte para ObjetivoService: borrar objetivos (5e) ---
	// Los proyectos "de" unos objetivos son los ligados directamente (proyecto.objetivo_id).

	/** Ids de los proyectos ligados directamente a alguno de esos objetivos. */
	@Transactional(readOnly = true)
	public List<Long> idsDeObjetivos(Collection<Long> objetivoIds) {
		if (objetivoIds.isEmpty()) {
			return List.of();
		}
		return repository.findByUsuarioIdAndObjetivoIdIn(USUARIO_ID, objetivoIds).stream().map(Proyecto::getId).toList();
	}

	/**
	 * Qué proyectos se borran al borrar esos objetivos con {@code proyectos=borrar}: los ligados directamente y todos
	 * sus subproyectos, EXCEPTO los rescatados. Un subproyecto ligado a un objetivo que no se borra se salva con su
	 * sub-árbol y sube al ancestro más cercano que sobrevive (o queda raíz). Un proyecto ligado directamente siempre
	 * se borra, aunque cuelgue de un rescatado. Solo lectura.
	 */
	@Transactional(readOnly = true)
	public PlanBorradoProyectos planBorradoPorObjetivos(Collection<Long> objetivoIds) {
		if (objetivoIds.isEmpty()) {
			return PlanBorradoProyectos.VACIO;
		}
		List<Proyecto> raices = repository.findByUsuarioIdAndObjetivoIdIn(USUARIO_ID, objetivoIds);
		Map<Long, List<Proyecto>> hijas = new HashMap<>();
		Function<Long, List<Proyecto>> hijasDe = pid ->
				hijas.computeIfAbsent(pid, k -> repository.findByPadreIdAndUsuarioId(k, USUARIO_ID));
		Predicate<Proyecto> rescatado = q -> q.getObjetivoId() != null && !objetivoIds.contains(q.getObjetivoId());

		List<Proyecto> aBorrar = Jerarquia.hojasPrimero(raices, Proyecto::getId, hijasDe, rescatado);
		Map<Long, Proyecto> borrados = new HashMap<>();
		aBorrar.forEach(p -> borrados.put(p.getId(), p));

		Map<Long, Long> rescatados = new LinkedHashMap<>();
		for (Proyecto p : aBorrar) {
			for (Proyecto hijo : hijasDe.apply(p.getId())) {
				if (rescatado.test(hijo)) {
					rescatados.put(hijo.getId(), ancestroQueSobrevive(hijo, borrados));
				}
			}
		}
		return new PlanBorradoProyectos(aBorrar.stream().map(Proyecto::getId).toList(), rescatados);
	}

	// Sube por padreId mientras el padre esté en el conjunto a borrar; el contador es solo red de seguridad ante ciclos.
	private static Long ancestroQueSobrevive(Proyecto hijo, Map<Long, Proyecto> borrados) {
		Long actual = hijo.getPadreId();
		for (int pasos = 0; actual != null && borrados.containsKey(actual) && pasos <= borrados.size(); pasos++) {
			actual = borrados.get(actual).getPadreId();
		}
		return actual;
	}

	/**
	 * Ejecuta el plan: reasigna el padre de los rescatados (con flush) y borra el resto, hojas primero.
	 * NO toca tareas ni ideas: quien llama ya las resolvió (si no, el SET NULL de la base las soltaría en silencio).
	 */
	public void ejecutarBorradoPorObjetivos(PlanBorradoProyectos plan) {
		if (plan.aBorrar().isEmpty()) {
			return;
		}
		Set<Long> todos = new HashSet<>(plan.aBorrar());
		todos.addAll(plan.rescatados().keySet());
		Map<Long, Proyecto> porId = new HashMap<>();
		repository.findAllById(todos).forEach(p -> porId.put(p.getId(), p));

		if (!plan.rescatados().isEmpty()) {
			List<Proyecto> salvados = new ArrayList<>();
			plan.rescatados().forEach((id, nuevoPadre) -> {
				Proyecto p = porId.get(id);
				p.setPadreId(nuevoPadre);
				salvados.add(p);
			});
			repository.saveAllAndFlush(salvados);
		}
		repository.deleteAll(plan.aBorrar().stream().map(porId::get).toList());
		repository.flush();
	}

	/** Deja sin objetivo (objetivo_id = null) a esos proyectos, que siguen existiendo con todo lo suyo. Hace flush. */
	public void desligarDeObjetivo(Collection<Long> proyectoIds) {
		if (proyectoIds.isEmpty()) {
			return;
		}
		List<Proyecto> proyectos = repository.findAllById(proyectoIds);
		proyectos.forEach(p -> p.setObjetivoId(null));
		repository.saveAllAndFlush(proyectos);
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

	private void validar(ProyectoRequest r, Long idActual) {
		Jerarquia.validarPadre("proyecto", r.padreId(), idActual,
				id -> repository.findByIdAndUsuarioId(id, USUARIO_ID), Proyecto::getPadreId,
				ProyectoInvalidoException::new);
		// 400 "El objetivo no existe: N" si no existe. La FK de la base queda como red de seguridad.
		if (r.objetivoId() != null) {
			objetivoConsultaService.validarExiste(r.objetivoId());
		}
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
