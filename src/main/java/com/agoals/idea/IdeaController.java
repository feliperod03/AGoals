package com.agoals.idea;

import com.agoals.idea.dto.ConcluirRequest;
import com.agoals.idea.dto.IdeaRequest;
import com.agoals.idea.dto.IdeaResponse;
import jakarta.validation.Valid;
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

import java.util.List;

@RestController
@RequestMapping("/api/ideas")
public class IdeaController {

	private final IdeaService service;

	public IdeaController(IdeaService service) {
		this.service = service;
	}

	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	public IdeaResponse crear(@Valid @RequestBody IdeaRequest request) {
		return service.crear(request);
	}

	@GetMapping("/{id}")
	public IdeaResponse obtener(@PathVariable Long id) {
		return service.obtener(id);
	}

	@GetMapping
	public List<IdeaResponse> listar(@RequestParam(required = false) EstadoIdea estado,
			@RequestParam(required = false) Long proyectoId,
			@RequestParam(required = false) Long objetivoId,
			@RequestParam(required = false) Boolean libres) {
		return service.listar(estado, proyectoId, objetivoId, libres);
	}

	@PutMapping("/{id}")
	public IdeaResponse actualizar(@PathVariable Long id, @Valid @RequestBody IdeaRequest request) {
		return service.actualizar(id, request);
	}

	@DeleteMapping("/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void eliminar(@PathVariable Long id) {
		service.eliminar(id);
	}

	// El cuerpo es opcional: sin body (o con {}) se conserva la conclusión que ya tenga la idea.
	@PatchMapping("/{id}/concluir")
	public IdeaResponse concluir(@PathVariable Long id, @RequestBody(required = false) ConcluirRequest request) {
		return service.concluir(id, request);
	}

	@PatchMapping("/{id}/reabrir")
	public IdeaResponse reabrir(@PathVariable Long id) {
		return service.reabrir(id);
	}
}
