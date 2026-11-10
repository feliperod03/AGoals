package com.agoals.objetivo;

import com.agoals.common.Estado;
import com.agoals.objetivo.dto.ObjetivoRequest;
import com.agoals.objetivo.dto.ObjetivoResponse;
import com.agoals.tarea.dto.TareaResponse;
import jakarta.validation.Valid;
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

import java.util.List;

@RestController
@RequestMapping("/api/objetivos")
public class ObjetivoController {

	private final ObjetivoService service;

	public ObjetivoController(ObjetivoService service) {
		this.service = service;
	}

	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	public ObjetivoResponse crear(@Valid @RequestBody ObjetivoRequest request) {
		return service.crear(request);
	}

	@GetMapping("/{id}")
	public ObjetivoResponse obtener(@PathVariable Long id) {
		return service.obtener(id);
	}

	@GetMapping
	public List<ObjetivoResponse> listar(@RequestParam(required = false) Estado estado) {
		return service.listar(estado);
	}

	@PutMapping("/{id}")
	public ObjetivoResponse actualizar(@PathVariable Long id, @Valid @RequestBody ObjetivoRequest request) {
		return service.actualizar(id, request);
	}

	@DeleteMapping("/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void eliminar(@PathVariable Long id,
			@RequestParam(required = false) String subobjetivos,
			@RequestParam(required = false) String proyectos,
			@RequestParam(required = false) String tareas,
			@RequestParam(required = false) String ideas) {
		// Cada parámetro llega como texto y se valida aquí (borrar|conservar): un valor desconocido responde 400.
		// Vacío = ausente. Sin ninguno, el comportamiento de siempre: 409 si hay dependencias.
		service.eliminar(id, EleccionesBorradoObjetivo.desde(subobjetivos, proyectos, tareas, ideas));
	}

	@GetMapping("/{id}/tareas")
	public List<TareaResponse> listarTareas(@PathVariable Long id) {
		return service.listarTareas(id);
	}

	@PutMapping("/{id}/tareas/{tareaId}")
	public TareaResponse asignarTarea(@PathVariable Long id, @PathVariable Long tareaId) {
		return service.asignarTarea(id, tareaId);
	}

	@DeleteMapping("/{id}/tareas/{tareaId}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void desasignarTarea(@PathVariable Long id, @PathVariable Long tareaId) {
		service.desasignarTarea(id, tareaId);
	}
}
