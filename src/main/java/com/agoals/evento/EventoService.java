package com.agoals.evento;

import com.agoals.evento.dto.EventoDeSerie;
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
	 * Sin 409: nada impide borrar un evento. Si tiene recordatorio, la base lo borra en cascada
	 * (recordatorio.evento_id ... ON DELETE CASCADE, ver V1): este servicio no lo toca.
	 */
	public void eliminar(Long id) {
		repository.delete(buscar(id));
	}

	// ---- Series (los usa el módulo serie; EventoService no conoce a serie ni a recordatorio) ----
	// No validan que la serie exista: lo hace quien llama (como TareaService con proyectos y objetivos).

	/** Crea las ocurrencias ya calculadas de una serie, en el orden recibido. */
	public List<EventoResponse> crearDeSerie(Long serieId, List<EventoDeSerie> ocurrencias) {
		return ocurrencias.stream().map(o -> {
			if (!o.fechaHoraFin().isAfter(o.fechaHoraInicio())) {
				throw new EventoInvalidoException("'fechaHoraFin' debe ser posterior a 'fechaHoraInicio'");
			}
			Evento evento = new Evento();
			evento.setUsuarioId(USUARIO_ID);
			evento.setSerieId(serieId);
			evento.setTitulo(o.titulo());
			evento.setDescripcion(o.descripcion() != null ? o.descripcion() : "");
			evento.setFechaHoraInicio(o.fechaHoraInicio());
			evento.setFechaHoraFin(o.fechaHoraFin());
			evento.setPrioridad(o.prioridad());
			return aRespuesta(repository.saveAndFlush(evento));
		}).toList();
	}

	/** Las ocurrencias de la serie con inicio >= desde (instante), por inicio e id. La elegida entra; las anteriores no. */
	@Transactional(readOnly = true)
	public List<EventoResponse> ocurrenciasDeSerieDesde(Long serieId, OffsetDateTime desde) {
		return repository.findBySerieIdAndUsuarioIdAndFechaHoraInicioGreaterThanEqualOrderByFechaHoraInicioAscIdAsc(
				serieId, USUARIO_ID, desde).stream().map(this::aRespuesta).toList();
	}

	/** Reemplaza los datos de una ocurrencia sin tocar su serie_id. */
	public EventoResponse actualizarDeSerie(Long id, EventoDeSerie datos) {
		Evento evento = buscar(id);
		if (!datos.fechaHoraFin().isAfter(datos.fechaHoraInicio())) {
			throw new EventoInvalidoException("'fechaHoraFin' debe ser posterior a 'fechaHoraInicio'");
		}
		evento.setTitulo(datos.titulo());
		evento.setDescripcion(datos.descripcion() != null ? datos.descripcion() : "");
		evento.setFechaHoraInicio(datos.fechaHoraInicio());
		evento.setFechaHoraFin(datos.fechaHoraFin());
		evento.setPrioridad(datos.prioridad());
		return aRespuesta(repository.saveAndFlush(evento));
	}

	/** Borra las ocurrencias de la serie con inicio >= desde (los recordatorios, en cascada en la base). */
	public int eliminarDeSerieDesde(Long serieId, OffsetDateTime desde) {
		List<Evento> aBorrar = repository
				.findBySerieIdAndUsuarioIdAndFechaHoraInicioGreaterThanEqualOrderByFechaHoraInicioAscIdAsc(
						serieId, USUARIO_ID, desde);
		repository.deleteAll(aBorrar);
		repository.flush();
		return aBorrar.size();
	}

	@Transactional(readOnly = true)
	public boolean existenDeSerie(Long serieId) {
		return repository.existsBySerieIdAndUsuarioId(serieId, USUARIO_ID);
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
				e.getFechaHoraFin(), e.getPrioridad(), e.getSerieId());
	}
}
