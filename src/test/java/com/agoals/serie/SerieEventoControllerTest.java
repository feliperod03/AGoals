package com.agoals.serie;

import com.agoals.common.ApiExceptionHandler;
import com.agoals.common.Prioridad;
import com.agoals.evento.EventoNoEncontradoException;
import com.agoals.evento.dto.EventoResponse;
import com.agoals.serie.dto.SerieEventoCreadaResponse;
import com.agoals.serie.dto.SerieEventoEdicionRequest;
import com.agoals.serie.dto.SerieEventoEdicionResponse;
import com.agoals.serie.dto.SerieEventoRequest;
import com.agoals.serie.dto.SerieEventoResponse;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(SerieEventoController.class)
@Import(ApiExceptionHandler.class)
class SerieEventoControllerTest {

	@Autowired
	MockMvc mvc;

	@MockitoBean
	SerieEventoService service;

	private static OffsetDateTime t(String iso) {
		return OffsetDateTime.parse(iso);
	}

	private static final String CUERPO = """
			{"titulo":"ZZ-rec Clase","descripcion":"Aula 3","prioridad":"MEDIA","horaInicio":"18:00","horaFin":"20:00",
			 "zonaHoraria":"America/Argentina/Buenos_Aires","ahora":"2098-03-10T10:00:00-03:00",
			 "frecuencia":"SEMANAL","diasSemana":["MIERCOLES","VIERNES"],"intervaloSemanas":2,"repeticiones":4,
			 "recordatorio":{"minutosAntes":30}}""";

	private static SerieEventoCreadaResponse creada() {
		SerieEventoResponse serie = new SerieEventoResponse(7L, Frecuencia.SEMANAL, Set.of(DiaSemana.MIERCOLES), 1, null,
				LocalDate.parse("2098-03-11"), null, 3, "America/Argentina/Buenos_Aires");
		EventoResponse e = new EventoResponse(100L, "ZZ-rec Clase", "", t("2098-03-11T18:00:00-03:00"),
				t("2098-03-11T20:00:00-03:00"), Prioridad.MEDIA, 7L);
		return new SerieEventoCreadaResponse(serie, List.of(e), 1, 0);
	}

	// ---- POST /api/series-eventos ----

	@Test
	void postValidoDevuelve201ConLaSerieYLosEventos() throws Exception {
		when(service.crear(any(SerieEventoRequest.class))).thenReturn(creada());

		mvc.perform(post("/api/series-eventos").contentType(MediaType.APPLICATION_JSON).content(CUERPO))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.serie.id").value(7))
				.andExpect(jsonPath("$.serie.frecuencia").value("SEMANAL"))
				.andExpect(jsonPath("$.eventos[0].id").value(100))
				.andExpect(jsonPath("$.eventos[0].serieId").value(7))
				.andExpect(jsonPath("$.recordatoriosCreados").value(1))
				.andExpect(jsonPath("$.recordatoriosOmitidos").value(0));
	}

	@Test
	void postPasaTodosLosCamposAlService() throws Exception {
		when(service.crear(any(SerieEventoRequest.class))).thenReturn(creada());

		mvc.perform(post("/api/series-eventos").contentType(MediaType.APPLICATION_JSON).content(CUERPO));

		ArgumentCaptor<SerieEventoRequest> captor = ArgumentCaptor.forClass(SerieEventoRequest.class);
		verify(service).crear(captor.capture());
		SerieEventoRequest r = captor.getValue();
		assertThat(r.titulo()).isEqualTo("ZZ-rec Clase");
		assertThat(r.horaInicio()).isEqualTo(LocalTime.of(18, 0));
		assertThat(r.horaFin()).isEqualTo(LocalTime.of(20, 0));
		assertThat(r.ahora().toInstant()).isEqualTo(t("2098-03-10T13:00:00Z").toInstant());
		assertThat(r.frecuencia()).isEqualTo(Frecuencia.SEMANAL);
		assertThat(r.diasSemana()).containsExactlyInAnyOrder(DiaSemana.MIERCOLES, DiaSemana.VIERNES);
		assertThat(r.intervaloSemanas()).isEqualTo(2);
		assertThat(r.repeticiones()).isEqualTo(4);
		assertThat(r.recordatorio().minutosAntes()).isEqualTo(30);
	}

	@Test
	void postSinTituloDevuelve400SinLlamarAlService() throws Exception {
		mvc.perform(post("/api/series-eventos").contentType(MediaType.APPLICATION_JSON)
						.content(CUERPO.replace("\"titulo\":\"ZZ-rec Clase\",", "")))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.errores[0]").value(containsString("titulo")));
		verifyNoInteractions(service);
	}

	@Test
	void postSinAhoraONiFrecuenciaDevuelve400() throws Exception {
		mvc.perform(post("/api/series-eventos").contentType(MediaType.APPLICATION_JSON)
						.content(CUERPO.replace("\"ahora\":\"2098-03-10T10:00:00-03:00\",", "")))
				.andExpect(status().isBadRequest());
		mvc.perform(post("/api/series-eventos").contentType(MediaType.APPLICATION_JSON)
						.content(CUERPO.replace("\"frecuencia\":\"SEMANAL\",", "")))
				.andExpect(status().isBadRequest());
		verifyNoInteractions(service);
	}

	@Test
	void postConUnDiaDeLaSemanaInexistenteDevuelve400() throws Exception {
		mvc.perform(post("/api/series-eventos").contentType(MediaType.APPLICATION_JSON)
						.content(CUERPO.replace("MIERCOLES", "MIERCOLE")))
				.andExpect(status().isBadRequest());
		verifyNoInteractions(service);
	}

	@Test
	void postConUnaHoraMalFormadaDevuelve400() throws Exception {
		mvc.perform(post("/api/series-eventos").contentType(MediaType.APPLICATION_JSON)
						.content(CUERPO.replace("\"18:00\"", "\"6 de la tarde\"")))
				.andExpect(status().isBadRequest());
		verifyNoInteractions(service);
	}

	@Test
	void postConMinutosAntesFueraDeRangoDevuelve400() throws Exception {
		mvc.perform(post("/api/series-eventos").contentType(MediaType.APPLICATION_JSON)
						.content(CUERPO.replace("\"minutosAntes\":30", "\"minutosAntes\":10081")))
				.andExpect(status().isBadRequest());
		mvc.perform(post("/api/series-eventos").contentType(MediaType.APPLICATION_JSON)
						.content(CUERPO.replace("\"minutosAntes\":30", "\"minutosAntes\":-1")))
				.andExpect(status().isBadRequest());
		verifyNoInteractions(service);
	}

	@Test
	void postConUnaReglaInvalidaSegunElServiceDevuelve400ConElMensaje() throws Exception {
		when(service.crear(any(SerieEventoRequest.class)))
				.thenThrow(new SerieEventoInvalidaException("Indica un final: 'hasta' o 'repeticiones', no ambos"));

		mvc.perform(post("/api/series-eventos").contentType(MediaType.APPLICATION_JSON).content(CUERPO))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.mensaje").value("Indica un final: 'hasta' o 'repeticiones', no ambos"));
	}

	// ---- GET /api/series-eventos/{id} ----

	@Test
	void getDevuelveLaSerie() throws Exception {
		when(service.obtener(7L)).thenReturn(creada().serie());

		mvc.perform(get("/api/series-eventos/7"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.id").value(7))
				.andExpect(jsonPath("$.diasSemana[0]").value("MIERCOLES"))
				.andExpect(jsonPath("$.fechaInicio").value("2098-03-11"))
				.andExpect(jsonPath("$.zonaHoraria").value("America/Argentina/Buenos_Aires"));
	}

	@Test
	void getDeUnaSerieInexistenteDevuelve404() throws Exception {
		when(service.obtener(9L)).thenThrow(new SerieEventoNoEncontradaException(9L));

		mvc.perform(get("/api/series-eventos/9"))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.mensaje").value("Serie no encontrada: 9"));
	}

	// ---- PUT /api/eventos/{id}/serie ----

	private static final String EDICION = """
			{"titulo":"ZZ-rec Nuevo","horaInicio":"19:00","horaFin":"21:00","ahora":"2098-03-10T10:00:00-03:00",
			 "prioridad":"ALTA","recordatorio":{}}""";

	@Test
	void putEditaTodaLaSerieYDevuelve200() throws Exception {
		EventoResponse e = new EventoResponse(100L, "ZZ-rec Nuevo", "", t("2098-03-11T19:00:00-03:00"),
				t("2098-03-11T21:00:00-03:00"), Prioridad.ALTA, 7L);
		when(service.editarDesde(any(), any(SerieEventoEdicionRequest.class)))
				.thenReturn(new SerieEventoEdicionResponse(List.of(e), 1));

		mvc.perform(put("/api/eventos/5/serie").contentType(MediaType.APPLICATION_JSON).content(EDICION))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.eventos[0].titulo").value("ZZ-rec Nuevo"))
				.andExpect(jsonPath("$.recordatoriosOmitidos").value(1));

		ArgumentCaptor<SerieEventoEdicionRequest> captor = ArgumentCaptor.forClass(SerieEventoEdicionRequest.class);
		verify(service).editarDesde(org.mockito.ArgumentMatchers.eq(5L), captor.capture());
		assertThat(captor.getValue().horaInicio()).isEqualTo(LocalTime.of(19, 0));
		assertThat(captor.getValue().recordatorio()).isNotNull();
		assertThat(captor.getValue().recordatorio().minutos()).isEqualTo(60);
	}

	@Test
	void putSinTituloDevuelve400() throws Exception {
		mvc.perform(put("/api/eventos/5/serie").contentType(MediaType.APPLICATION_JSON)
						.content(EDICION.replace("\"titulo\":\"ZZ-rec Nuevo\",", "")))
				.andExpect(status().isBadRequest());
		verifyNoInteractions(service);
	}

	@Test
	void putSobreUnEventoSueltoDevuelve409() throws Exception {
		when(service.editarDesde(any(), any(SerieEventoEdicionRequest.class)))
				.thenThrow(new SerieEventoConflictoException("El evento 5 no pertenece a una serie: usa la edición normal"));

		mvc.perform(put("/api/eventos/5/serie").contentType(MediaType.APPLICATION_JSON).content(EDICION))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.mensaje").value(containsString("no pertenece a una serie")));
	}

	@Test
	void putSobreUnEventoInexistenteDevuelve404() throws Exception {
		when(service.editarDesde(any(), any(SerieEventoEdicionRequest.class)))
				.thenThrow(new EventoNoEncontradoException(5L));

		mvc.perform(put("/api/eventos/5/serie").contentType(MediaType.APPLICATION_JSON).content(EDICION))
				.andExpect(status().isNotFound());
	}

	// ---- DELETE /api/eventos/{id}/serie ----

	@Test
	void deleteDevuelve204() throws Exception {
		mvc.perform(delete("/api/eventos/5/serie")).andExpect(status().isNoContent());

		verify(service).eliminarDesde(5L);
	}

	@Test
	void deleteSobreUnEventoSueltoDevuelve409() throws Exception {
		doThrow(new SerieEventoConflictoException("El evento 5 no pertenece a una serie: usa la edición normal"))
				.when(service).eliminarDesde(5L);

		mvc.perform(delete("/api/eventos/5/serie")).andExpect(status().isConflict());
	}

	@Test
	void deleteSobreUnEventoInexistenteDevuelve404() throws Exception {
		doThrow(new EventoNoEncontradoException(5L)).when(service).eliminarDesde(5L);

		mvc.perform(delete("/api/eventos/5/serie")).andExpect(status().isNotFound());
	}
}
