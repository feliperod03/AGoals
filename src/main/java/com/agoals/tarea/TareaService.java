package com.agoals.tarea;

import com.agoals.common.Estado;
import com.agoals.common.Jerarquia;
import com.agoals.tarea.dto.AgendaResponse;
import com.agoals.tarea.dto.PosponerRequest;
import com.agoals.tarea.dto.TareaRequest;
import com.agoals.common.Prioridad;
import com.agoals.tarea.dto.TareaRecomendadaResponse;
import com.agoals.tarea.dto.TareaResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Predicate;

@Service
@Transactional
public class TareaService {

	// La v1 no tiene login: todo pertenece al usuario creado en V2.
	static final Long USUARIO_ID = 1L;

	private final TareaRepository repository;

	public TareaService(TareaRepository repository) {
		this.repository = repository;
	}

	public TareaResponse crear(TareaRequest request) {
		validar(request, null);
		Tarea tarea = new Tarea();
		tarea.setUsuarioId(USUARIO_ID);
		aplicar(tarea, request);
		return aRespuesta(repository.save(tarea));
	}

	@Transactional(readOnly = true)
	public TareaResponse obtener(Long id) {
		return aRespuesta(buscar(id));
	}

	@Transactional(readOnly = true)
	public List<TareaResponse> listar() {
		return repository.findByUsuarioIdOrderByFechaAscIdAsc(USUARIO_ID).stream()
				.map(this::aRespuesta)
				.toList();
	}

	public TareaResponse actualizar(Long id, TareaRequest request) {
		Tarea tarea = buscar(id);
		validar(request, id);
		aplicar(tarea, request);
		return aRespuesta(repository.save(tarea));
	}

	// Desde la API nunca se borra en cascada, aunque la base tenga ON DELETE CASCADE en padre_id:
	// hay que mover o borrar las subtareas antes (igual que proyectos y objetivos).
	public void eliminar(Long id) {
		Tarea tarea = buscar(id);
		if (repository.existsByPadreIdAndUsuarioId(id, USUARIO_ID)) {
			throw new TareaConDependenciasException(
					"La tarea " + id + " tiene subtareas: muévelas o bórralas primero");
		}
		repository.delete(tarea);
	}

	// Sueltas: ALTA primero, sin prioridad al final (el orden del enum es BAJA, MEDIA, ALTA), luego por id.
	private static final Comparator<Tarea> ORDEN_SUELTAS = Comparator
			.comparing(Tarea::getPrioridad, Comparator.nullsLast(Comparator.reverseOrder()))
			.thenComparing(Tarea::getId);

	@Transactional(readOnly = true)
	public AgendaResponse agendaDelDia(LocalDate fecha) {
		List<Tarea> delDia = repository.findByUsuarioIdAndFechaOrderByHoraInicioAscIdAsc(USUARIO_ID, fecha);
		// La consulta ya ordena por hora e id; las que tienen hora conservan ese orden.
		List<TareaResponse> conHora = delDia.stream()
				.filter(t -> t.getHoraInicio() != null)
				.map(this::aRespuesta)
				.toList();
		List<TareaResponse> sinHora = delDia.stream()
				.filter(t -> t.getHoraInicio() == null)
				.sorted(ORDEN_SUELTAS)
				.map(this::aRespuesta)
				.toList();
		return new AgendaResponse(fecha, conHora, sinHora);
	}

	// Estados que siguen "abiertos": una tarea con fecha pasada en alguno de ellos quedó sin hacer.
	private static final List<Estado> ESTADOS_ABIERTOS = List.of(Estado.PENDIENTE, Estado.EN_PROGRESO, Estado.EN_PAUSA);

	// Atrasadas: fecha más vieja primero, luego ALTA primero (sin prioridad al final), luego por id.
	private static final Comparator<Tarea> ORDEN_ATRASADAS = Comparator
			.comparing(Tarea::getFecha)
			.thenComparing(ORDEN_SUELTAS);

	/**
	 * Tareas abiertas con fecha anterior a {@code fecha} (el "hoy" del cliente; el día mismo no cuenta).
	 * Las tareas sin fecha no son atrasadas: están sin agendar. La prioridad se ordena aquí y no en SQL
	 * porque se guarda como texto y el orden alfabético no coincide con ALTA > MEDIA > BAJA.
	 */
	@Transactional(readOnly = true)
	public List<TareaResponse> atrasadas(LocalDate fecha) {
		return repository.findByUsuarioIdAndFechaBeforeAndEstadoIn(USUARIO_ID, fecha, ESTADOS_ABIERTOS).stream()
				.sorted(ORDEN_ATRASADAS)
				.map(this::aRespuesta)
				.toList();
	}

	static final int LIMITE_RECOMENDACION_DEFECTO = 50;
	static final int LIMITE_RECOMENDACION_MAXIMO = 200;

	/**
	 * Recomendación: tareas abiertas sin fecha o atrasadas (fecha anterior a {@code fecha}), de cualquier tipo.
	 * Se arma un árbol con TODAS las candidatas (sin filtrar). Con filtros, las raíces son las candidatas que
	 * cumplen el filtro y no tienen ningún ancestro candidato que también lo cumpla (así nadie sale dos veces);
	 * bajo cada raíz se anidan todas sus hijas candidatas, cumplan o no el filtro, para una vista previa completa.
	 * El filtro se aplica aquí y no en SQL justamente porque hacen falta las hijas que no lo cumplen.
	 */
	@Transactional(readOnly = true)
	public List<TareaRecomendadaResponse> recomendacion(LocalDate fecha, OrdenRecomendacion orden, SentidoOrden sentido,
			Integer limite, Long proyectoId, Long objetivoId) {
		if (limite != null && limite <= 0) {
			throw new TareaInvalidaException("limite debe ser mayor que 0");
		}
		int tope = limite == null ? LIMITE_RECOMENDACION_DEFECTO : Math.min(limite, LIMITE_RECOMENDACION_MAXIMO);
		Comparator<Tarea> comparador = comparadorRecomendacion(
				orden != null ? orden : OrdenRecomendacion.PRIORIDAD,
				sentido != null ? sentido : SentidoOrden.DESC);

		List<Tarea> candidatas = repository.findCandidatasRecomendacion(USUARIO_ID, fecha, ESTADOS_ABIERTOS);
		Map<Long, Tarea> porId = new HashMap<>();
		candidatas.forEach(t -> porId.put(t.getId(), t));
		Map<Long, List<Tarea>> hijasDe = new HashMap<>();
		for (Tarea t : candidatas) {
			if (t.getPadreId() != null && porId.containsKey(t.getPadreId())) {
				hijasDe.computeIfAbsent(t.getPadreId(), k -> new ArrayList<>()).add(t);
			}
		}

		Predicate<Tarea> cumple = t -> (proyectoId == null || proyectoId.equals(t.getProyectoId()))
				&& (objetivoId == null || objetivoId.equals(t.getObjetivoId()));
		return candidatas.stream()
				.filter(cumple)
				.filter(t -> !tieneAncestroQueCumple(t, porId, cumple))
				.sorted(comparador)
				.limit(tope)
				.map(t -> aRecomendada(t, hijasDe, comparador))
				.toList();
	}

	// Sube por padreId mientras el padre sea candidata. La API impide ciclos; el contador es solo una red de seguridad.
	private static boolean tieneAncestroQueCumple(Tarea t, Map<Long, Tarea> porId, Predicate<Tarea> cumple) {
		Tarea actual = t;
		for (int pasos = 0; pasos <= porId.size(); pasos++) {
			Tarea padre = actual.getPadreId() == null ? null : porId.get(actual.getPadreId());
			if (padre == null) {
				return false;
			}
			if (cumple.test(padre)) {
				return true;
			}
			actual = padre;
		}
		return false;
	}

	private TareaRecomendadaResponse aRecomendada(Tarea t, Map<Long, List<Tarea>> hijasDe, Comparator<Tarea> comparador) {
		List<TareaRecomendadaResponse> subtareas = hijasDe.getOrDefault(t.getId(), List.of()).stream()
				.sorted(comparador)
				.map(h -> aRecomendada(h, hijasDe, comparador))
				.toList();
		return new TareaRecomendadaResponse(aRespuesta(t), subtareas);
	}

	private static Comparator<Tarea> comparadorRecomendacion(OrdenRecomendacion orden, SentidoOrden sentido) {
		boolean desc = sentido == SentidoOrden.DESC;
		Comparator<Tarea> principal;
		if (orden == OrdenRecomendacion.PRIORIDAD) {
			// El enum es BAJA < MEDIA < ALTA: el orden natural es asc; desc = ALTA primero. Sin prioridad, al final.
			principal = Comparator.comparing(Tarea::getPrioridad,
					Comparator.nullsLast(desc ? Comparator.<Prioridad>reverseOrder() : Comparator.<Prioridad>naturalOrder()));
		} else {
			// "desc" pone primero la más antigua (fecha más baja), "asc" la más reciente.
			principal = desc
					? Comparator.comparing(TareaService::claveAntiguedad)
					: Comparator.comparing(TareaService::claveAntiguedad, Comparator.reverseOrder());
		}
		return principal.thenComparing(Tarea::getId);
	}

	// Fecha de la tarea si tiene; si no, la de creación. Si ambas faltan (entidad armada a mano, aún sin guardar)
	// cuenta como la más reciente en vez de lanzar NullPointerException.
	private static LocalDate claveAntiguedad(Tarea t) {
		if (t.getFecha() != null) {
			return t.getFecha();
		}
		return t.getFechaCreacion() != null ? t.getFechaCreacion().toLocalDate() : LocalDate.MAX;
	}

	/** Deshace un "hecha" por error: HECHO pasa a PENDIENTE. Si ya estaba abierta no cambia (idempotente). */
	public TareaResponse reabrir(Long id) {
		Tarea tarea = buscar(id);
		if (tarea.getEstado() == Estado.CANCELADO) {
			throw new TareaEstadoInvalidaException("No se puede reabrir una tarea cancelada: " + id);
		}
		if (tarea.getEstado() == Estado.HECHO) {
			// No se guarda el estado previo al "hecha", así que siempre vuelve a PENDIENTE.
			tarea.setEstado(Estado.PENDIENTE);
			return aRespuesta(repository.save(tarea));
		}
		// PENDIENTE, EN_PROGRESO o EN_PAUSA: ya está abierta, se devuelve tal cual (no degrada EN_PROGRESO).
		return aRespuesta(tarea);
	}

	public TareaResponse marcarHecha(Long id) {
		Tarea tarea = buscar(id);
		if (tarea.getEstado() == Estado.CANCELADO) {
			throw new TareaEstadoInvalidaException("No se puede marcar como hecha una tarea cancelada: " + id);
		}
		// Si ya estaba HECHO no pasa nada: la operación es idempotente.
		tarea.setEstado(Estado.HECHO);
		return aRespuesta(repository.save(tarea));
	}

	public TareaResponse posponer(Long id, PosponerRequest request) {
		Tarea tarea = buscar(id);
		if (tarea.getEstado() == Estado.HECHO || tarea.getEstado() == Estado.CANCELADO) {
			throw new TareaEstadoInvalidaException(
					"No se puede posponer una tarea en estado " + tarea.getEstado() + ": " + id);
		}
		LocalDate actual = tarea.getFecha();
		LocalDate pedida = request != null ? request.fecha() : null;
		LocalDate nueva;
		if (pedida != null) {
			if (actual != null && !pedida.isAfter(actual)) {
				throw new TareaInvalidaException("La nueva fecha debe ser posterior a la actual (" + actual + ")");
			}
			nueva = pedida;
		} else if (actual != null) {
			// Por defecto suma un día a la fecha de la TAREA, no a "hoy": si estaba atrasada,
			// el resultado puede seguir en el pasado y hay que posponer de nuevo o indicar fecha.
			nueva = actual.plusDays(1);
		} else {
			throw new TareaInvalidaException("La tarea no tiene fecha: indica a qué día posponerla");
		}
		tarea.posponerA(nueva);
		return aRespuesta(repository.save(tarea));
	}

	// --- Soporte para los módulos proyecto y objetivo ---
	// Estos métodos NO validan que el proyecto u objetivo exista: lo hace quien llama
	// (ProyectoService / ObjetivoService). La FK de la base queda como red de seguridad.

	/** Asigna la tarea a un proyecto, o la deja sin proyecto si proyectoId es null. */
	public TareaResponse asignarProyecto(Long tareaId, Long proyectoId) {
		Tarea tarea = buscar(tareaId);
		tarea.setProyectoId(proyectoId);
		return aRespuesta(repository.save(tarea));
	}

	@Transactional(readOnly = true)
	public List<TareaResponse> listarPorProyecto(Long proyectoId) {
		return repository.findByUsuarioIdAndProyectoIdOrderByFechaAscIdAsc(USUARIO_ID, proyectoId).stream()
				.map(this::aRespuesta)
				.toList();
	}

	@Transactional(readOnly = true)
	public boolean existenTareasDelProyecto(Long proyectoId) {
		return repository.existsByUsuarioIdAndProyectoId(USUARIO_ID, proyectoId);
	}

	/** Liga la tarea directamente a un objetivo, o la deja sin objetivo si objetivoId es null. */
	public TareaResponse asignarObjetivo(Long tareaId, Long objetivoId) {
		Tarea tarea = buscar(tareaId);
		tarea.setObjetivoId(objetivoId);
		return aRespuesta(repository.save(tarea));
	}

	/** Solo las tareas ligadas directamente al objetivo (objetivo_id), no las que llegan vía sus proyectos. */
	@Transactional(readOnly = true)
	public List<TareaResponse> listarPorObjetivo(Long objetivoId) {
		return repository.findByUsuarioIdAndObjetivoIdOrderByFechaAscIdAsc(USUARIO_ID, objetivoId).stream()
				.map(this::aRespuesta)
				.toList();
	}

	@Transactional(readOnly = true)
	public boolean existenTareasDelObjetivo(Long objetivoId) {
		return repository.existsByUsuarioIdAndObjetivoId(USUARIO_ID, objetivoId);
	}

	private Tarea buscar(Long id) {
		return repository.findByIdAndUsuarioId(id, USUARIO_ID)
				.orElseThrow(() -> new TareaNoEncontradaException(id));
	}

	// Espejo de los CHECK de V1, para responder 400 con mensaje claro en vez de 500.
	private void validar(TareaRequest r, Long idActual) {
		if (r.horaInicio() != null && r.fecha() == null) {
			throw new TareaInvalidaException("hora_inicio exige fecha");
		}
		if (r.horaFin() != null && r.horaInicio() == null) {
			throw new TareaInvalidaException("hora_fin exige hora_inicio");
		}
		if (r.horaFin() != null && !r.horaFin().isAfter(r.horaInicio())) {
			throw new TareaInvalidaException("hora_fin debe ser posterior a hora_inicio");
		}
		// Padre existente y sin ciclos (una tarea no puede quedar como su propia descendiente).
		Jerarquia.validarPadre("tarea", true, r.padreId(), idActual,
				id -> repository.findByIdAndUsuarioId(id, USUARIO_ID), Tarea::getPadreId,
				TareaInvalidaException::new);
	}

	private void aplicar(Tarea tarea, TareaRequest r) {
		tarea.setTitulo(r.titulo());
		tarea.setDescripcion(r.descripcion());
		tarea.setEstado(r.estado() != null ? r.estado() : Estado.PENDIENTE);
		tarea.setPrioridad(r.prioridad());
		tarea.setFecha(r.fecha());
		tarea.setHoraInicio(r.horaInicio());
		tarea.setHoraFin(r.horaFin());
		tarea.setPadreId(r.padreId());
	}

	private TareaResponse aRespuesta(Tarea t) {
		return new TareaResponse(t.getId(), t.getTitulo(), t.getDescripcion(), t.getEstado(),
				t.getPrioridad(), t.getFecha(), t.getHoraInicio(), t.getHoraFin(), t.getPadreId(), t.getProyectoId(), t.getObjetivoId(),
				t.getVecesPospuesta(), t.getFechaCreacion());
	}
}
