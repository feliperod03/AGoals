package com.agoals.recordatorio;

import com.agoals.evento.EventoService;
import com.agoals.recordatorio.dto.RecordatorioRequest;
import com.agoals.recordatorio.dto.RecordatorioResponse;
import com.agoals.tarea.TareaService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Objects;

@Service
@Transactional
public class RecordatorioService {

	// La v1 no tiene login: todo pertenece al usuario creado en V2.
	static final Long USUARIO_ID = 1L;

	private final RecordatorioRepository repository;
	private final TareaService tareaService;
	private final EventoService eventoService;

	// Dependencias en un solo sentido: recordatorio -> tarea / evento, solo a través de sus services.
	// TareaService y EventoService NO conocen a recordatorio (el borrado en cascada lo hace la base), así que no hay ciclo.
	public RecordatorioService(RecordatorioRepository repository, TareaService tareaService,
			EventoService eventoService) {
		this.repository = repository;
		this.tareaService = tareaService;
		this.eventoService = eventoService;
	}

	public RecordatorioResponse crear(RecordatorioRequest request) {
		validar(request);
		if (request.tareaId() != null) {
			validarSinRecordatorioDeTarea(request.tareaId());
		}
		if (request.eventoId() != null) {
			validarSinRecordatorioDeEvento(request.eventoId());
		}
		Recordatorio r = new Recordatorio();
		r.setUsuarioId(USUARIO_ID);
		aplicar(r, request);
		return aRespuesta(repository.saveAndFlush(r));
	}

	@Transactional(readOnly = true)
	public RecordatorioResponse obtener(Long id) {
		return aRespuesta(buscar(id));
	}

	/** Filtros opcionales. Un recordatorio no puede ser de tarea y evento a la vez: pedir ambos devuelve lista vacía. */
	@Transactional(readOnly = true)
	public List<RecordatorioResponse> listar(Long tareaId, Long eventoId) {
		return repository.findByUsuarioIdOrderByFechaHoraAscIdAsc(USUARIO_ID).stream()
				.filter(r -> tareaId == null || tareaId.equals(r.getTareaId()))
				.filter(r -> eventoId == null || eventoId.equals(r.getEventoId()))
				.map(this::aRespuesta)
				.toList();
	}

	/**
	 * Pendientes de avisar: enviado = false y fechaHora <= ahora. `ahora` lo manda el cliente (el servidor no usa su reloj).
	 * No mira el estado de la tarea: el recordatorio de una tarea HECHA o CANCELADA sigue apareciendo (ver modelo-datos.md).
	 */
	@Transactional(readOnly = true)
	public List<RecordatorioResponse> vencidos(OffsetDateTime ahora) {
		return repository.findByUsuarioIdAndEnviadoFalseAndFechaHoraLessThanEqualOrderByFechaHoraAscIdAsc(USUARIO_ID, ahora)
				.stream()
				.map(this::aRespuesta)
				.toList();
	}

	/**
	 * Reemplazo completo. El 409 por duplicado solo se comprueba si el tareaId / eventoId CAMBIA respecto del actual
	 * (si el vínculo es el mismo, el recordatorio no choca consigo mismo). Si cambia fechaHora, enviado vuelve a false.
	 */
	public RecordatorioResponse actualizar(Long id, RecordatorioRequest request) {
		Recordatorio r = buscar(id);
		validar(request);
		if (request.tareaId() != null && !request.tareaId().equals(r.getTareaId())) {
			validarSinRecordatorioDeTarea(request.tareaId());
		}
		if (request.eventoId() != null && !request.eventoId().equals(r.getEventoId())) {
			validarSinRecordatorioDeEvento(request.eventoId());
		}
		// isEqual compara instantes: el mismo momento escrito con otro desfase no cuenta como cambio.
		boolean cambiaLaFecha = !request.fechaHora().isEqual(r.getFechaHora());
		aplicar(r, request);
		if (cambiaLaFecha) {
			r.setEnviado(false);
		}
		return aRespuesta(repository.saveAndFlush(r));
	}

	/** enviado = true. Idempotente: si ya estaba enviado no cambia nada. */
	public RecordatorioResponse marcarEnviado(Long id) {
		Recordatorio r = buscar(id);
		if (!r.isEnviado()) {
			r.setEnviado(true);
			r = repository.saveAndFlush(r);
		}
		return aRespuesta(r);
	}

	public void eliminar(Long id) {
		repository.delete(buscar(id));
	}

	private Recordatorio buscar(Long id) {
		return repository.findByIdAndUsuarioId(id, USUARIO_ID)
				.orElseThrow(() -> new RecordatorioNoEncontradoException(id));
	}

	// Todas las reglas que dan 400, antes de comprobar duplicados (409).
	private void validar(RecordatorioRequest r) {
		if (r.tareaId() != null && r.eventoId() != null) {
			throw new RecordatorioInvalidoException("Un recordatorio no puede ser de una tarea y de un evento a la vez");
		}
		if (r.tareaId() != null) {
			tareaService.validarExiste(r.tareaId());
		}
		if (r.eventoId() != null) {
			eventoService.validarExiste(r.eventoId());
		}
		if (r.tareaId() == null && r.eventoId() == null
				&& (r.descripcion() == null || r.descripcion().isBlank())) {
			throw new RecordatorioInvalidoException("Un recordatorio suelto (sin tarea ni evento) necesita una descripción");
		}
		if (r.canal() == Canal.CORREO) {
			throw new RecordatorioInvalidoException("El canal CORREO todavía no está disponible: usa APP");
		}
	}

	private void validarSinRecordatorioDeTarea(Long tareaId) {
		if (repository.existsByTareaIdAndUsuarioId(tareaId, USUARIO_ID)) {
			throw new RecordatorioConflictoException("La tarea " + tareaId + " ya tiene un recordatorio");
		}
	}

	private void validarSinRecordatorioDeEvento(Long eventoId) {
		if (repository.existsByEventoIdAndUsuarioId(eventoId, USUARIO_ID)) {
			throw new RecordatorioConflictoException("El evento " + eventoId + " ya tiene un recordatorio");
		}
	}

	private void aplicar(Recordatorio r, RecordatorioRequest req) {
		r.setTareaId(req.tareaId());
		r.setEventoId(req.eventoId());
		r.setFechaHora(req.fechaHora());
		r.setCanal(Objects.requireNonNullElse(req.canal(), Canal.APP));
		r.setDescripcion(req.descripcion() != null ? req.descripcion() : "");
	}

	private RecordatorioResponse aRespuesta(Recordatorio r) {
		return new RecordatorioResponse(r.getId(), r.getTareaId(), r.getEventoId(), r.getFechaHora(), r.getCanal(),
				r.isEnviado(), r.getDescripcion());
	}
}
