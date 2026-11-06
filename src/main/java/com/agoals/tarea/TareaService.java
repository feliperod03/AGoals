package com.agoals.tarea;

import com.agoals.common.Estado;
import com.agoals.common.Jerarquia;
import com.agoals.tarea.dto.AgendaResponse;
import com.agoals.tarea.dto.PosponerRequest;
import com.agoals.tarea.dto.TareaRequest;
import com.agoals.tarea.dto.TareaResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;

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

	public void eliminar(Long id) {
		repository.delete(buscar(id));
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
