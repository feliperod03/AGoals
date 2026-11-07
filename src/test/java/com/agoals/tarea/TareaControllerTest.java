package com.agoals.tarea;

import com.agoals.common.Estado;

import com.agoals.common.ApiExceptionHandler;
import com.agoals.tarea.dto.AgendaResponse;
import com.agoals.tarea.dto.PosponerRequest;
import com.agoals.tarea.dto.TareaRequest;
import com.agoals.tarea.dto.TareaResponse;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(TareaController.class)
@Import(ApiExceptionHandler.class)
class TareaControllerTest {

	@Autowired
	MockMvc mvc;

	@MockitoBean
	TareaService service;

	private static TareaResponse respuesta(Long id, String titulo) {
		return new TareaResponse(id, titulo, null, Estado.PENDIENTE, null, null, null, null, null, null, null, 0, null);
	}

	@Test
	void postValidoDevuelve201() throws Exception {
		when(service.crear(any(TareaRequest.class))).thenReturn(respuesta(1L, "Comprar pan"));

		mvc.perform(post("/api/tareas").contentType(MediaType.APPLICATION_JSON)
						.content("{\"titulo\":\"Comprar pan\"}"))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.id").value(1))
				.andExpect(jsonPath("$.titulo").value("Comprar pan"))
				.andExpect(jsonPath("$.estado").value("PENDIENTE"));
	}

	@Test
	void postConTituloVacioDevuelve400() throws Exception {
		mvc.perform(post("/api/tareas").contentType(MediaType.APPLICATION_JSON)
						.content("{\"titulo\":\"\"}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.errores[0]").value(org.hamcrest.Matchers.containsString("titulo")));
	}

	@Test
	void postConReglaInvalidaDevuelve400() throws Exception {
		when(service.crear(any(TareaRequest.class))).thenThrow(new TareaInvalidaException("hora_inicio exige fecha"));

		mvc.perform(post("/api/tareas").contentType(MediaType.APPLICATION_JSON)
						.content("{\"titulo\":\"x\",\"horaInicio\":\"09:00\"}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.mensaje").value("hora_inicio exige fecha"));
	}

	@Test
	void getPorIdDevuelve200() throws Exception {
		when(service.obtener(1L)).thenReturn(respuesta(1L, "a"));

		mvc.perform(get("/api/tareas/1"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.titulo").value("a"));
	}

	@Test
	void getPorIdInexistenteDevuelve404() throws Exception {
		when(service.obtener(7L)).thenThrow(new TareaNoEncontradaException(7L));

		mvc.perform(get("/api/tareas/7")).andExpect(status().isNotFound());
	}

	@Test
	void getListaDevuelveArreglo() throws Exception {
		when(service.listar()).thenReturn(List.of(respuesta(1L, "a"), respuesta(2L, "b")));

		mvc.perform(get("/api/tareas"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(2))
				.andExpect(jsonPath("$[1].titulo").value("b"));
	}

	@Test
	void putValidoDevuelve200() throws Exception {
		when(service.actualizar(eq(1L), any(TareaRequest.class))).thenReturn(respuesta(1L, "nueva"));

		mvc.perform(put("/api/tareas/1").contentType(MediaType.APPLICATION_JSON)
						.content("{\"titulo\":\"nueva\"}"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.titulo").value("nueva"));
	}

	@Test
	void putInexistenteDevuelve404() throws Exception {
		when(service.actualizar(eq(7L), any(TareaRequest.class))).thenThrow(new TareaNoEncontradaException(7L));

		mvc.perform(put("/api/tareas/7").contentType(MediaType.APPLICATION_JSON)
						.content("{\"titulo\":\"x\"}"))
				.andExpect(status().isNotFound());
	}

	@Test
	void deleteDevuelve204() throws Exception {
		mvc.perform(delete("/api/tareas/1")).andExpect(status().isNoContent());

		verify(service).eliminar(1L);
	}

	@Test
	void deleteConSubtareasDevuelve409ConElMotivo() throws Exception {
		doThrow(new TareaConDependenciasException("La tarea 1 tiene subtareas: muévelas o bórralas primero"))
				.when(service).eliminar(1L);

		mvc.perform(delete("/api/tareas/1"))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.mensaje").value(org.hamcrest.Matchers.containsString("subtareas")));
	}

	@Test
	void deleteInexistenteDevuelve404() throws Exception {
		doThrow(new TareaNoEncontradaException(7L)).when(service).eliminar(7L);

		mvc.perform(delete("/api/tareas/7")).andExpect(status().isNotFound());
	}

	// ---- Atrasadas ----

	@Test
	void atrasadasDevuelveLaListaYPasaLaFechaAlService() throws Exception {
		LocalDate hoy = LocalDate.of(2026, 11, 6);
		when(service.atrasadas(hoy)).thenReturn(List.of(respuesta(1L, "vieja"), respuesta(2L, "otra")));

		mvc.perform(get("/api/tareas/atrasadas").param("fecha", "2026-11-06"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(2))
				.andExpect(jsonPath("$[0].titulo").value("vieja"));
		verify(service).atrasadas(hoy);
	}

	@Test
	void atrasadasSinResultadosDevuelveArregloVacio() throws Exception {
		when(service.atrasadas(LocalDate.of(2026, 11, 6))).thenReturn(List.of());

		mvc.perform(get("/api/tareas/atrasadas").param("fecha", "2026-11-06"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(0));
	}

	@Test
	void atrasadasSinFechaDevuelve400() throws Exception {
		mvc.perform(get("/api/tareas/atrasadas")).andExpect(status().isBadRequest());
	}

	@Test
	void atrasadasConFechaMalFormadaDevuelve400() throws Exception {
		mvc.perform(get("/api/tareas/atrasadas").param("fecha", "06-11-2026")).andExpect(status().isBadRequest());
	}

	// ---- Reabrir ----

	@Test
	void reabrirDevuelve200ConLaTareaPendiente() throws Exception {
		when(service.reabrir(1L)).thenReturn(respuesta(1L, "a"));

		mvc.perform(patch("/api/tareas/1/reabrir"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.estado").value("PENDIENTE"));
	}

	@Test
	void reabrirInexistenteDevuelve404() throws Exception {
		when(service.reabrir(7L)).thenThrow(new TareaNoEncontradaException(7L));

		mvc.perform(patch("/api/tareas/7/reabrir")).andExpect(status().isNotFound());
	}

	@Test
	void reabrirUnaCanceladaDevuelve409() throws Exception {
		when(service.reabrir(1L)).thenThrow(new TareaEstadoInvalidaException("No se puede reabrir una tarea cancelada: 1"));

		mvc.perform(patch("/api/tareas/1/reabrir"))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.mensaje").value("No se puede reabrir una tarea cancelada: 1"));
	}

	@Test
	void putQueCreaUnCicloDevuelve400() throws Exception {
		when(service.actualizar(eq(1L), any(TareaRequest.class)))
				.thenThrow(new TareaInvalidaException("Ciclo en la jerarquía: la tarea 2 es descendiente de la tarea 1"));

		mvc.perform(put("/api/tareas/1").contentType(MediaType.APPLICATION_JSON)
						.content("{\"titulo\":\"x\",\"padreId\":2}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.mensaje").value(org.hamcrest.Matchers.containsString("Ciclo")));
	}

	// ---- Agenda del día ----

	@Test
	void getAgendaDevuelveConHoraYSinHora() throws Exception {
		LocalDate dia = LocalDate.of(2026, 11, 6);
		when(service.agendaDelDia(dia)).thenReturn(new AgendaResponse(dia,
				List.of(respuesta(1L, "con hora")), List.of(respuesta(2L, "suelta"), respuesta(3L, "otra"))));

		mvc.perform(get("/api/tareas/agenda").param("fecha", "2026-11-06"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.fecha").value("2026-11-06"))
				.andExpect(jsonPath("$.conHora.length()").value(1))
				.andExpect(jsonPath("$.conHora[0].titulo").value("con hora"))
				.andExpect(jsonPath("$.sinHora.length()").value(2))
				.andExpect(jsonPath("$.sinHora[1].titulo").value("otra"));
	}

	@Test
	void getAgendaSinFechaDevuelve400() throws Exception {
		mvc.perform(get("/api/tareas/agenda")).andExpect(status().isBadRequest());
	}

	@Test
	void getAgendaConFechaMalFormadaDevuelve400() throws Exception {
		mvc.perform(get("/api/tareas/agenda").param("fecha", "06-11-2026")).andExpect(status().isBadRequest());
	}

	@Test
	void patchHechaDevuelve200() throws Exception {
		when(service.marcarHecha(1L)).thenReturn(
				new TareaResponse(1L, "a", null, Estado.HECHO, null, null, null, null, null, null, null, 0, null));

		mvc.perform(patch("/api/tareas/1/hecha"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.estado").value("HECHO"));
	}

	@Test
	void patchHechaInexistenteDevuelve404() throws Exception {
		when(service.marcarHecha(7L)).thenThrow(new TareaNoEncontradaException(7L));

		mvc.perform(patch("/api/tareas/7/hecha")).andExpect(status().isNotFound());
	}

	@Test
	void patchHechaDeTareaCanceladaDevuelve409() throws Exception {
		when(service.marcarHecha(2L)).thenThrow(new TareaEstadoInvalidaException("cancelada"));

		mvc.perform(patch("/api/tareas/2/hecha"))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.mensaje").value("cancelada"));
	}

	@Test
	void patchPosponerSinBodyDevuelve200() throws Exception {
		LocalDate manana = LocalDate.of(2026, 11, 7);
		when(service.posponer(eq(1L), isNull())).thenReturn(
				new TareaResponse(1L, "a", null, Estado.PENDIENTE, null, manana, null, null, null, null, null, 1, null));

		mvc.perform(patch("/api/tareas/1/posponer"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.fecha").value("2026-11-07"))
				.andExpect(jsonPath("$.vecesPospuesta").value(1));
	}

	@Test
	void patchPosponerConFechaDevuelve200() throws Exception {
		LocalDate destino = LocalDate.of(2026, 11, 20);
		when(service.posponer(eq(1L), eq(new PosponerRequest(destino)))).thenReturn(
				new TareaResponse(1L, "a", null, Estado.PENDIENTE, null, destino, null, null, null, null, null, 1, null));

		mvc.perform(patch("/api/tareas/1/posponer").contentType(MediaType.APPLICATION_JSON)
						.content("{\"fecha\":\"2026-11-20\"}"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.fecha").value("2026-11-20"));
	}

	@Test
	void patchPosponerInexistenteDevuelve404() throws Exception {
		when(service.posponer(eq(7L), any())).thenThrow(new TareaNoEncontradaException(7L));

		mvc.perform(patch("/api/tareas/7/posponer")).andExpect(status().isNotFound());
	}

	@Test
	void patchPosponerTareaHechaOCanceladaDevuelve409() throws Exception {
		when(service.posponer(eq(2L), any())).thenThrow(new TareaEstadoInvalidaException("ya hecha"));

		mvc.perform(patch("/api/tareas/2/posponer"))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.mensaje").value("ya hecha"));
	}

	@Test
	void patchPosponerConReglaInvalidaDevuelve400() throws Exception {
		when(service.posponer(eq(3L), any())).thenThrow(new TareaInvalidaException("sin fecha"));

		mvc.perform(patch("/api/tareas/3/posponer"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.mensaje").value("sin fecha"));
	}

	@Test
	void patchPosponerConFechaMalFormadaDevuelve400() throws Exception {
		mvc.perform(patch("/api/tareas/1/posponer").contentType(MediaType.APPLICATION_JSON)
						.content("{\"fecha\":\"mañana\"}"))
				.andExpect(status().isBadRequest());
	}
}
