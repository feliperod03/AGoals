package com.agoals.evento;

import com.agoals.common.ApiExceptionHandler;
import com.agoals.common.Prioridad;
import com.agoals.evento.dto.EventoRequest;
import com.agoals.evento.dto.EventoResponse;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.OffsetDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(EventoController.class)
@Import(ApiExceptionHandler.class)
class EventoControllerTest {

	@Autowired
	MockMvc mvc;

	@MockitoBean
	EventoService service;

	private static OffsetDateTime t(String iso) {
		return OffsetDateTime.parse(iso);
	}

	private static EventoResponse respuesta(Long id, String titulo) {
		return new EventoResponse(id, titulo, "", t("2026-11-10T15:00:00-03:00"), t("2026-11-10T16:00:00-03:00"), null);
	}

	private static final String CUERPO_VALIDO = """
			{"titulo":"Dentista","fechaHoraInicio":"2026-11-10T15:00:00-03:00","fechaHoraFin":"2026-11-10T16:00:00-03:00"}""";

	// ---- Crear ----

	@Test
	void postValidoDevuelve201() throws Exception {
		when(service.crear(any(EventoRequest.class))).thenReturn(respuesta(1L, "Dentista"));

		mvc.perform(post("/api/eventos").contentType(MediaType.APPLICATION_JSON).content(CUERPO_VALIDO))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.id").value(1))
				.andExpect(jsonPath("$.titulo").value("Dentista"))
				.andExpect(jsonPath("$.fechaHoraInicio").isNotEmpty())
				.andExpect(jsonPath("$.fechaHoraFin").isNotEmpty());
	}

	@Test
	void postPasaTodosLosCamposAlServiceConLosInstantesCorrectos() throws Exception {
		when(service.crear(any(EventoRequest.class))).thenReturn(respuesta(1L, "Dentista"));

		mvc.perform(post("/api/eventos").contentType(MediaType.APPLICATION_JSON).content("""
				{"titulo":"Dentista","descripcion":"d","fechaHoraInicio":"2026-11-10T15:00:00-03:00",
				 "fechaHoraFin":"2026-11-10T16:00:00-03:00","prioridad":"ALTA"}"""));

		ArgumentCaptor<EventoRequest> captor = ArgumentCaptor.forClass(EventoRequest.class);
		verify(service).crear(captor.capture());
		EventoRequest r = captor.getValue();
		assertThat(r.titulo()).isEqualTo("Dentista");
		assertThat(r.descripcion()).isEqualTo("d");
		assertThat(r.prioridad()).isEqualTo(Prioridad.ALTA);
		// Se comparan instantes: el desfase del objeto deserializado depende de la zona de la JVM.
		assertThat(r.fechaHoraInicio().toInstant()).isEqualTo(t("2026-11-10T18:00:00Z").toInstant());
		assertThat(r.fechaHoraFin().toInstant()).isEqualTo(t("2026-11-10T19:00:00Z").toInstant());
	}

	@Test
	void postSinTituloDevuelve400() throws Exception {
		mvc.perform(post("/api/eventos").contentType(MediaType.APPLICATION_JSON).content("""
						{"fechaHoraInicio":"2026-11-10T15:00:00-03:00","fechaHoraFin":"2026-11-10T16:00:00-03:00"}"""))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.errores[0]").value(containsString("titulo")));
		verifyNoInteractions(service);
	}

	@Test
	void postConTituloVacioDevuelve400() throws Exception {
		mvc.perform(post("/api/eventos").contentType(MediaType.APPLICATION_JSON).content("""
						{"titulo":"   ","fechaHoraInicio":"2026-11-10T15:00:00-03:00","fechaHoraFin":"2026-11-10T16:00:00-03:00"}"""))
				.andExpect(status().isBadRequest());
		verifyNoInteractions(service);
	}

	@Test
	void postConTituloDeMasDe200CaracteresDevuelve400() throws Exception {
		String largo = "x".repeat(201);
		mvc.perform(post("/api/eventos").contentType(MediaType.APPLICATION_JSON).content(
						"{\"titulo\":\"" + largo + "\",\"fechaHoraInicio\":\"2026-11-10T15:00:00-03:00\","
								+ "\"fechaHoraFin\":\"2026-11-10T16:00:00-03:00\"}"))
				.andExpect(status().isBadRequest());
		verifyNoInteractions(service);
	}

	@Test
	void postConTituloDe200CaracteresEsValido() throws Exception {
		when(service.crear(any(EventoRequest.class))).thenReturn(respuesta(1L, "x"));
		String justo = "x".repeat(200);

		mvc.perform(post("/api/eventos").contentType(MediaType.APPLICATION_JSON).content(
						"{\"titulo\":\"" + justo + "\",\"fechaHoraInicio\":\"2026-11-10T15:00:00-03:00\","
								+ "\"fechaHoraFin\":\"2026-11-10T16:00:00-03:00\"}"))
				.andExpect(status().isCreated());
	}

	@Test
	void postSinInicioODevuelve400() throws Exception {
		mvc.perform(post("/api/eventos").contentType(MediaType.APPLICATION_JSON).content("""
						{"titulo":"x","fechaHoraFin":"2026-11-10T16:00:00-03:00"}"""))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.errores[0]").value(containsString("fechaHoraInicio")));
		mvc.perform(post("/api/eventos").contentType(MediaType.APPLICATION_JSON).content("""
						{"titulo":"x","fechaHoraInicio":"2026-11-10T15:00:00-03:00"}"""))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.errores[0]").value(containsString("fechaHoraFin")));
		verifyNoInteractions(service);
	}

	@Test
	void postConFechaMalFormadaDevuelve400() throws Exception {
		mvc.perform(post("/api/eventos").contentType(MediaType.APPLICATION_JSON).content("""
						{"titulo":"x","fechaHoraInicio":"10/11/2026","fechaHoraFin":"2026-11-10T16:00:00-03:00"}"""))
				.andExpect(status().isBadRequest());
		verifyNoInteractions(service);
	}

	@Test
	void postConPrioridadInvalidaDevuelve400() throws Exception {
		mvc.perform(post("/api/eventos").contentType(MediaType.APPLICATION_JSON).content("""
						{"titulo":"x","fechaHoraInicio":"2026-11-10T15:00:00-03:00",
						 "fechaHoraFin":"2026-11-10T16:00:00-03:00","prioridad":"URGENTE"}"""))
				.andExpect(status().isBadRequest());
		verifyNoInteractions(service);
	}

	@Test
	void postConFinNoPosteriorDevuelve400ConElMensajeDelService() throws Exception {
		when(service.crear(any(EventoRequest.class)))
				.thenThrow(new EventoInvalidoException("'fechaHoraFin' debe ser posterior a 'fechaHoraInicio'"));

		mvc.perform(post("/api/eventos").contentType(MediaType.APPLICATION_JSON).content(CUERPO_VALIDO))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.mensaje").value(containsString("fechaHoraFin")));
	}

	// ---- Obtener ----

	@Test
	void getPorIdDevuelve200() throws Exception {
		when(service.obtener(1L)).thenReturn(respuesta(1L, "Dentista"));

		mvc.perform(get("/api/eventos/1"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.titulo").value("Dentista"));
	}

	@Test
	void getInexistenteDevuelve404() throws Exception {
		when(service.obtener(9L)).thenThrow(new EventoNoEncontradoException(9L));

		mvc.perform(get("/api/eventos/9"))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.mensaje").value(containsString("9")));
	}

	@Test
	void getConIdNoNumericoDevuelve400() throws Exception {
		mvc.perform(get("/api/eventos/abc")).andExpect(status().isBadRequest());
		verifyNoInteractions(service);
	}

	// ---- Listar ----

	@Test
	void getSinFiltrosLlamaAlServiceConNulls() throws Exception {
		when(service.listar(isNull(), isNull())).thenReturn(List.of(respuesta(1L, "a"), respuesta(2L, "b")));

		mvc.perform(get("/api/eventos"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(2))
				.andExpect(jsonPath("$[0].id").value(1))
				.andExpect(jsonPath("$[1].id").value(2));
	}

	@Test
	void getConDesdeYHastaLosPasaComoInstantes() throws Exception {
		when(service.listar(any(), any())).thenReturn(List.of());

		mvc.perform(get("/api/eventos")
						.param("desde", "2026-11-10T00:00:00-03:00")
						.param("hasta", "2026-11-11T00:00:00-03:00"))
				.andExpect(status().isOk());

		ArgumentCaptor<OffsetDateTime> desde = ArgumentCaptor.forClass(OffsetDateTime.class);
		ArgumentCaptor<OffsetDateTime> hasta = ArgumentCaptor.forClass(OffsetDateTime.class);
		verify(service).listar(desde.capture(), hasta.capture());
		assertThat(desde.getValue().toInstant()).isEqualTo(t("2026-11-10T03:00:00Z").toInstant());
		assertThat(hasta.getValue().toInstant()).isEqualTo(t("2026-11-11T03:00:00Z").toInstant());
	}

	@Test
	void getConSoloDesdePasaHastaNull() throws Exception {
		when(service.listar(any(), isNull())).thenReturn(List.of());

		mvc.perform(get("/api/eventos").param("desde", "2026-11-10T00:00:00Z")).andExpect(status().isOk());

		verify(service).listar(any(OffsetDateTime.class), isNull());
	}

	@Test
	void getConSoloHastaPasaDesdeNull() throws Exception {
		when(service.listar(isNull(), any())).thenReturn(List.of());

		mvc.perform(get("/api/eventos").param("hasta", "2026-11-10T00:00:00Z")).andExpect(status().isOk());

		verify(service).listar(isNull(), any(OffsetDateTime.class));
	}

	@Test
	void getConDesdeMalFormadoDevuelve400() throws Exception {
		mvc.perform(get("/api/eventos").param("desde", "abc"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.mensaje").value(containsString("desde")));
		verifyNoInteractions(service);
	}

	@Test
	void getConHastaSoloConFechaSinHoraDevuelve400() throws Exception {
		mvc.perform(get("/api/eventos").param("hasta", "2026-11-10"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.mensaje").value(containsString("hasta")));
		verifyNoInteractions(service);
	}

	@Test
	void getConHastaNoPosteriorADesdeDevuelve400() throws Exception {
		when(service.listar(any(), any())).thenThrow(new EventoInvalidoException("'hasta' debe ser posterior a 'desde'"));

		mvc.perform(get("/api/eventos")
						.param("desde", "2026-11-11T00:00:00-03:00")
						.param("hasta", "2026-11-10T00:00:00-03:00"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.mensaje").value(containsString("hasta")));
	}

	// ---- Actualizar ----

	@Test
	void putValidoDevuelve200() throws Exception {
		when(service.actualizar(any(), any(EventoRequest.class))).thenReturn(respuesta(1L, "Nuevo"));

		mvc.perform(put("/api/eventos/1").contentType(MediaType.APPLICATION_JSON).content(CUERPO_VALIDO))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.titulo").value("Nuevo"));
	}

	@Test
	void putInexistenteDevuelve404() throws Exception {
		when(service.actualizar(any(), any(EventoRequest.class))).thenThrow(new EventoNoEncontradoException(9L));

		mvc.perform(put("/api/eventos/9").contentType(MediaType.APPLICATION_JSON).content(CUERPO_VALIDO))
				.andExpect(status().isNotFound());
	}

	@Test
	void putSinTituloDevuelve400() throws Exception {
		mvc.perform(put("/api/eventos/1").contentType(MediaType.APPLICATION_JSON).content("""
						{"fechaHoraInicio":"2026-11-10T15:00:00-03:00","fechaHoraFin":"2026-11-10T16:00:00-03:00"}"""))
				.andExpect(status().isBadRequest());
		verifyNoInteractions(service);
	}

	@Test
	void putConFinNoPosteriorDevuelve400() throws Exception {
		when(service.actualizar(any(), any(EventoRequest.class)))
				.thenThrow(new EventoInvalidoException("'fechaHoraFin' debe ser posterior a 'fechaHoraInicio'"));

		mvc.perform(put("/api/eventos/1").contentType(MediaType.APPLICATION_JSON).content(CUERPO_VALIDO))
				.andExpect(status().isBadRequest());
	}

	// ---- Borrar ----

	@Test
	void deleteDevuelve204() throws Exception {
		mvc.perform(delete("/api/eventos/1")).andExpect(status().isNoContent());

		verify(service).eliminar(1L);
	}

	@Test
	void deleteInexistenteDevuelve404() throws Exception {
		doThrow(new EventoNoEncontradoException(9L)).when(service).eliminar(9L);

		mvc.perform(delete("/api/eventos/9")).andExpect(status().isNotFound());
	}

	@Test
	void deleteConIdNoNumericoDevuelve400() throws Exception {
		mvc.perform(delete("/api/eventos/abc")).andExpect(status().isBadRequest());
		verify(service, never()).eliminar(any());
	}
}
