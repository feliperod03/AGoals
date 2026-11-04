package com.agoals.tarea;

import com.agoals.tarea.dto.TareaRequest;
import com.agoals.tarea.dto.TareaResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
		if (r.padreId() != null) {
			if (r.padreId().equals(idActual)) {
				throw new TareaInvalidaException("Una tarea no puede ser su propio padre");
			}
			if (repository.findByIdAndUsuarioId(r.padreId(), USUARIO_ID).isEmpty()) {
				throw new TareaInvalidaException("La tarea padre no existe: " + r.padreId());
			}
		}
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
				t.getPrioridad(), t.getFecha(), t.getHoraInicio(), t.getHoraFin(), t.getPadreId(),
				t.getVecesPospuesta(), t.getFechaCreacion());
	}
}
