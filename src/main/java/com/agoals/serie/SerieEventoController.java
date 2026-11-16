package com.agoals.serie;

import com.agoals.serie.dto.SerieEventoCreadaResponse;
import com.agoals.serie.dto.SerieEventoEdicionRequest;
import com.agoals.serie.dto.SerieEventoEdicionResponse;
import com.agoals.serie.dto.SerieEventoRequest;
import com.agoals.serie.dto.SerieEventoResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class SerieEventoController {

	private final SerieEventoService service;

	public SerieEventoController(SerieEventoService service) {
		this.service = service;
	}

	@PostMapping("/api/series-eventos")
	@ResponseStatus(HttpStatus.CREATED)
	public SerieEventoCreadaResponse crear(@Valid @RequestBody SerieEventoRequest request) {
		return service.crear(request);
	}

	@GetMapping("/api/series-eventos/{id}")
	public SerieEventoResponse obtener(@PathVariable Long id) {
		return service.obtener(id);
	}

	// "Toda la serie" se cuelga del evento elegido: es "esta ocurrencia y las siguientes". El PUT/DELETE de
	// /api/eventos/{id} sigue siendo "solo este".
	@PutMapping("/api/eventos/{id}/serie")
	public SerieEventoEdicionResponse editarDesde(@PathVariable Long id,
			@Valid @RequestBody SerieEventoEdicionRequest request) {
		return service.editarDesde(id, request);
	}

	@DeleteMapping("/api/eventos/{id}/serie")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void eliminarDesde(@PathVariable Long id) {
		service.eliminarDesde(id);
	}
}
