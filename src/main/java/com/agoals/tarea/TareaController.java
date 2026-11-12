package com.agoals.tarea;

import com.agoals.tarea.dto.AgendaResponse;
import com.agoals.tarea.dto.AgendarRequest;
import com.agoals.tarea.dto.PosponerRequest;
import com.agoals.tarea.dto.TareaRecomendadaResponse;
import com.agoals.tarea.dto.TareaRequest;
import com.agoals.tarea.dto.TareaResponse;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/tareas")
public class TareaController {

	private final TareaService service;

	public TareaController(TareaService service) {
		this.service = service;
	}

	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	public TareaResponse crear(@Valid @RequestBody TareaRequest request) {
		return service.crear(request);
	}

	@GetMapping("/agenda")
	public AgendaResponse agenda(@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fecha) {
		return service.agendaDelDia(fecha);
	}

	@GetMapping("/atrasadas")
	public List<TareaResponse> atrasadas(@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fecha) {
		return service.atrasadas(fecha);
	}

	@GetMapping("/recomendacion")
	public List<TareaRecomendadaResponse> recomendacion(
			@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fecha,
			@RequestParam(required = false) String orden,
			@RequestParam(required = false) String sentido,
			@RequestParam(required = false) Integer limite,
			@RequestParam(required = false) Long proyectoId,
			@RequestParam(required = false) Long objetivoId,
			@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate hasta) {
		// orden y sentido llegan como texto y se validan aquí: un valor desconocido responde 400 con mensaje claro.
		OrdenRecomendacion ordenValido = OrdenRecomendacion.desde(orden);
		SentidoOrden sentidoValido = SentidoOrden.desde(sentido);
		// Sin "hasta" se llama a la firma de siempre: el comportamiento anterior queda intacto.
		if (hasta == null) {
			return service.recomendacion(fecha, ordenValido, sentidoValido, limite, proyectoId, objetivoId);
		}
		return service.recomendacion(fecha, ordenValido, sentidoValido, limite, proyectoId, objetivoId, hasta);
	}

	@PatchMapping("/{id}/reabrir")
	public TareaResponse reabrir(@PathVariable Long id) {
		return service.reabrir(id);
	}

	@PatchMapping("/{id}/hecha")
	public TareaResponse marcarHecha(@PathVariable Long id) {
		return service.marcarHecha(id);
	}

	@PatchMapping("/{id}/posponer")
	public TareaResponse posponer(@PathVariable Long id, @RequestBody(required = false) PosponerRequest request) {
		return service.posponer(id, request);
	}

	@PatchMapping("/{id}/agendar")
	public List<TareaResponse> agendar(@PathVariable Long id, @Valid @RequestBody AgendarRequest request) {
		return service.agendar(id, request);
	}

	@GetMapping("/{id}")
	public TareaResponse obtener(@PathVariable Long id) {
		return service.obtener(id);
	}

	@GetMapping
	public List<TareaResponse> listar() {
		return service.listar();
	}

	@PutMapping("/{id}")
	public TareaResponse actualizar(@PathVariable Long id, @Valid @RequestBody TareaRequest request) {
		return service.actualizar(id, request);
	}

	@DeleteMapping("/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void eliminar(@PathVariable Long id, @RequestParam(required = false) String subtareas) {
		// subtareas llega como texto y se valida aquí (borrar|conservar): un valor desconocido responde 400.
		service.eliminar(id, ModoSubtareas.desde(subtareas));
	}
}
