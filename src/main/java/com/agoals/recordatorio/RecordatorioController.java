package com.agoals.recordatorio;

import com.agoals.recordatorio.dto.RecordatorioRequest;
import com.agoals.recordatorio.dto.RecordatorioResponse;
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

import java.time.OffsetDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/recordatorios")
public class RecordatorioController {

	private final RecordatorioService service;

	public RecordatorioController(RecordatorioService service) {
		this.service = service;
	}

	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	public RecordatorioResponse crear(@Valid @RequestBody RecordatorioRequest request) {
		return service.crear(request);
	}

	@GetMapping("/{id}")
	public RecordatorioResponse obtener(@PathVariable Long id) {
		return service.obtener(id);
	}

	@GetMapping
	public List<RecordatorioResponse> listar(@RequestParam(required = false) Long tareaId,
			@RequestParam(required = false) Long eventoId) {
		return service.listar(tareaId, eventoId);
	}

	// `ahora` es obligatorio y lo manda el cliente (ISO con desfase; un + va como %2B en la URL).
	@GetMapping("/vencidos")
	public List<RecordatorioResponse> vencidos(
			@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime ahora) {
		return service.vencidos(ahora);
	}

	@PutMapping("/{id}")
	public RecordatorioResponse actualizar(@PathVariable Long id, @Valid @RequestBody RecordatorioRequest request) {
		return service.actualizar(id, request);
	}

	@PatchMapping("/{id}/marcar-enviado")
	public RecordatorioResponse marcarEnviado(@PathVariable Long id) {
		return service.marcarEnviado(id);
	}

	@DeleteMapping("/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void eliminar(@PathVariable Long id) {
		service.eliminar(id);
	}
}
