package com.agoals.tarea;

import com.agoals.tarea.dto.AgendaResponse;
import com.agoals.tarea.dto.PosponerRequest;
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

	@PatchMapping("/{id}/hecha")
	public TareaResponse marcarHecha(@PathVariable Long id) {
		return service.marcarHecha(id);
	}

	@PatchMapping("/{id}/posponer")
	public TareaResponse posponer(@PathVariable Long id, @RequestBody(required = false) PosponerRequest request) {
		return service.posponer(id, request);
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
	public void eliminar(@PathVariable Long id) {
		service.eliminar(id);
	}
}
