package com.agoals.evento;

import com.agoals.evento.dto.EventoRequest;
import com.agoals.evento.dto.EventoResponse;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.OffsetDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/eventos")
public class EventoController {

	private final EventoService service;

	public EventoController(EventoService service) {
		this.service = service;
	}

	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	public EventoResponse crear(@Valid @RequestBody EventoRequest request) {
		return service.crear(request);
	}

	@GetMapping("/{id}")
	public EventoResponse obtener(@PathVariable Long id) {
		return service.obtener(id);
	}

	// `desde` y `hasta` son instantes ISO con desfase (p. ej. 2026-11-10T00:00:00-03:00). El cliente decide qué es
	// "un día". Ojo: un desfase positivo en la URL lleva el + codificado como %2B.
	@GetMapping
	public List<EventoResponse> listar(
			@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime desde,
			@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime hasta) {
		return service.listar(desde, hasta);
	}

	@PutMapping("/{id}")
	public EventoResponse actualizar(@PathVariable Long id, @Valid @RequestBody EventoRequest request) {
		return service.actualizar(id, request);
	}

	@DeleteMapping("/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void eliminar(@PathVariable Long id) {
		service.eliminar(id);
	}
}
