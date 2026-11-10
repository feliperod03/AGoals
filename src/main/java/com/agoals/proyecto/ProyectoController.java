package com.agoals.proyecto;

import com.agoals.common.Estado;
import com.agoals.proyecto.dto.ProyectoRequest;
import com.agoals.proyecto.dto.ProyectoResponse;
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
@RequestMapping("/api/proyectos")
public class ProyectoController {

	private final ProyectoService service;

	public ProyectoController(ProyectoService service) {
		this.service = service;
	}

	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	public ProyectoResponse crear(@Valid @RequestBody ProyectoRequest request) {
		return service.crear(request);
	}

	@GetMapping("/{id}")
	public ProyectoResponse obtener(@PathVariable Long id) {
		return service.obtener(id);
	}

	@GetMapping
	public List<ProyectoResponse> listar(@RequestParam(required = false) Estado estado,
			@RequestParam(required = false) Long objetivoId) {
		return service.listar(estado, objetivoId);
	}

	@PutMapping("/{id}")
	public ProyectoResponse actualizar(@PathVariable Long id, @Valid @RequestBody ProyectoRequest request) {
		return service.actualizar(id, request);
	}

	@DeleteMapping("/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void eliminar(@PathVariable Long id,
			@RequestParam(required = false) String subproyectos,
			@RequestParam(required = false) String tareas,
			@RequestParam(required = false) String ideas) {
		// Cada parámetro llega como texto y se valida aquí (borrar|conservar): un valor desconocido responde 400.
		// Vacío = ausente. Sin ninguno, el comportamiento de siempre: 409 si hay dependencias.
		service.eliminar(id, EleccionesBorradoProyecto.desde(subproyectos, tareas, ideas));
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
