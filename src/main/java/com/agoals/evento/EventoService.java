package com.agoals.evento;

import com.agoals.evento.dto.EventoRequest;
import com.agoals.evento.dto.EventoResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;

@Service
@Transactional
public class EventoService {

	// La v1 no tiene login: todo pertenece al usuario creado en V2.
	static final Long USUARIO_ID = 1L;

	private final EventoRepository repository;

	public EventoService(EventoRepository repository) {
		this.repository = repository;
	}

	public EventoResponse crear(EventoRequest request) {
		validar(request);
		Evento evento = new Evento();
		evento.setUsuarioId(USUARIO_ID);
		aplicar(evento, request);
		return aRespuesta(repository.saveAndFlush(evento));
	}

	@Transactional(readOnly = true)
	public EventoResponse obtener(Long id) {
		return aRespuesta(buscar(id));
	}

	/** Solo lectura, para otros módulos (recordatorio): 400 si el evento no existe, para validar el cuerpo de una petición. */
	@Transactional(readOnly = true)
	public void validarExiste(Long id) {
		if (repository.findByIdAndUsuarioId(id, USUARIO_ID).isEmpty()) {
			throw new EventoInvalidoException("El evento no existe: " + id);
		}
	}

	/**
	 * Eventos que se solapan con [desde, hasta]: inicio < hasta y fin > desde (los bordes exactos no entran).
	 * Un extremo null no acota ese lado. El servidor no calcula días: el cliente manda el rango que quiere.
	 */
	@Transactional(readOnly = true)
	public List<EventoResponse> listar(OffsetDateTime desde, OffsetDateTime hasta) {
		if (desde != null && hasta != null && !hasta.isAfter(desde)) {
			throw new EventoInvalidoException("'hasta' debe ser posterior a 'desde'");
		}
		// El orden (inicio, id) lo da el repository; aquí solo se descartan los que no se solapan.
		// isBefore/isAfter comparan instantes, no el desfase con el que se guardó o se pidió cada fecha.
		return repository.findByUsuarioIdOrderByFechaHoraInicioAscIdAsc(USUARIO_ID).stream()
				.filter(e -> hasta == null || e.getFechaHoraInicio().isBefore(hasta))
				.filter(e -> desde == null || e.getFechaHoraFin().isAfter(desde))
				.map(this::aRespuesta)
				.toList();
	}

	/** Reemplazo completo: un campo opcional que no viene queda vacío (descripcion) o null (prioridad). */
	public EventoResponse actualizar(Long id, EventoRequest request) {
		Evento evento = buscar(id);
		validar(request);
		aplicar(evento, request);
		return aRespuesta(repository.saveAndFlush(evento));
	}

	/**
	 * Sin 409: hoy nada depende de un evento. Cuando exista el módulo recordatorio (7b), un evento con
	 * recordatorio también se podrá borrar y la base borrará el recordatorio en cascada (ON DELETE CASCADE).
	 */
	public void eliminar(Long id) {
		repository.delete(buscar(id));
	}

	private Evento buscar(Long id) {
		return repository.findByIdAndUsuarioId(id, USUARIO_ID)
				.orElseThrow(() -> new EventoNoEncontradoException(id));
	}

	// isAfter compara instantes: no depende del desfase con el que llegó cada fecha. La base lo rechaza también (CHECK).
	private void validar(EventoRequest r) {
		if (!r.fechaHoraFin().isAfter(r.fechaHoraInicio())) {
			throw new EventoInvalidoException("'fechaHoraFin' debe ser posterior a 'fechaHoraInicio'");
		}
	}

	private void aplicar(Evento evento, EventoRequest r) {
		evento.setTitulo(r.titulo());
		evento.setDescripcion(r.descripcion() != null ? r.descripcion() : "");
		evento.setFechaHoraInicio(r.fechaHoraInicio());
		evento.setFechaHoraFin(r.fechaHoraFin());
		evento.setPrioridad(r.prioridad());
	}

	private EventoResponse aRespuesta(Evento e) {
		return new EventoResponse(e.getId(), e.getTitulo(), e.getDescripcion(), e.getFechaHoraInicio(),
				e.getFechaHoraFin(), e.getPrioridad());
	}
}
