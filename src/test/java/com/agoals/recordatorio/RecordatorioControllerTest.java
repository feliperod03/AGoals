package com.agoals.recordatorio;

import com.agoals.common.ApiExceptionHandler;
import com.agoals.evento.EventoInvalidoException;
import com.agoals.recordatorio.dto.RecordatorioRequest;
import com.agoals.recordatorio.dto.RecordatorioResponse;
import com.agoals.tarea.TareaInvalidaException;
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
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(RecordatorioController.class)
@Import(ApiExceptionHandler.class)
class RecordatorioControllerTest {

	@Autowired
	MockMvc mvc;

	@MockitoBean
	RecordatorioService service;

	private static OffsetDateTime t(String iso) {
		return OffsetDateTime.parse(iso);
	}

	private static RecordatorioResponse respuesta(Long id) {
		return new RecordatorioResponse(id, null, null, t("2098-03-10T10:00:00-03:00"), Canal.APP, false, "avisar");
	}

	private static final String CUERPO_VALIDO = """
			{"fechaHora":"2098-03-10T10:00:00-03:00","descripcion":"avisar"}""";

	// ---- Crear ----

	@Test
	void postValidoDevuelve201() throws Exception {
		when(service.crear(any(RecordatorioRequest.class))).thenReturn(respuesta(1L));

		mvc.perform(post("/api/recordatorios").contentType(MediaType.APPLICATION_JSON).content(CUERPO_VALIDO))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.id").value(1))
				.andExpect(jsonPath("$.canal").value("APP"))
				.andExpect(jsonPath("$.enviado").value(false))
				.andExpect(jsonPath("$.descripcion").value("avisar"))
				.andExpect(jsonPath("$.fechaHora").isNotEmpty());
	}

	@Test
	void postPasaTodosLosCamposAlServiceConLosInstantesCorrectos() throws Exception {
		when(service.crear(any(RecordatorioRequest.class))).thenReturn(respuesta(1L));

		mvc.perform(post("/api/recordatorios").contentType(MediaType.APPLICATION_JSON).content("""
				{"tareaId":5,"fechaHora":"2098-03-10T10:00:00-03:00","canal":"APP","descripcion":"d"}"""));

		ArgumentCaptor<RecordatorioRequest> captor = ArgumentCaptor.forClass(RecordatorioRequest.class);
		verify(service).crear(captor.capture());
		RecordatorioRequest r = captor.getValue();
		assertThat(r.tareaId()).isEqualTo(5L);
		assertThat(r.eventoId()).isNull();
		assertThat(r.canal()).isEqualTo(Canal.APP);
		assertThat(r.descripcion()).isEqualTo("d");
		// Se comparan instantes: el desfase del objeto deserializado depende de la zona de la JVM.
		assertThat(r.fechaHora().toInstant()).isEqualTo(t("2098-03-10T13:00:00Z").toInstant());
	}

	@Test
	void postSinFechaHoraDevuelve400() throws Exception {
		mvc.perform(post("/api/recordatorios").contentType(MediaType.APPLICATION_JSON).content("""
						{"descripcion":"avisar"}"""))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.errores[0]").value(containsString("fechaHora")));
		verifyNoInteractions(service);
	}

	@Test
	void postConFechaHoraMalFormadaDevuelve400() throws Exception {
		mvc.perform(post("/api/recordatorios").contentType(MediaType.APPLICATION_JSON).content("""
						{"fechaHora":"10/03/2098","descripcion":"avisar"}"""))
				.andExpect(status().isBadRequest());
		verifyNoInteractions(service);
	}

	@Test
	void postConCanalCorreoDevuelve400ConMensajeClaro() throws Exception {
		when(service.crear(any(RecordatorioRequest.class)))
				.thenThrow(new RecordatorioInvalidoException("El canal CORREO todavía no está disponible: usa APP"));

		mvc.perform(post("/api/recordatorios").contentType(MediaType.APPLICATION_JSON).content("""
						{"fechaHora":"2098-03-10T10:00:00-03:00","canal":"CORREO","descripcion":"x"}"""))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.mensaje").value(containsString("CORREO")));
	}

	@Test
	void postConCanalQueNoExisteEnElEnumDevuelve400ConMensajeClaroNo500() throws Exception {
		mvc.perform(post("/api/recordatorios").contentType(MediaType.APPLICATION_JSON).content("""
						{"fechaHora":"2098-03-10T10:00:00-03:00","canal":"raro","descripcion":"x"}"""))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.mensaje").value(containsString("canal")))
				.andExpect(jsonPath("$.mensaje").value(containsString("APP")));
		verifyNoInteractions(service);
	}

	@Test
	void postConTareaYEventoALaVezDevuelve400() throws Exception {
		when(service.crear(any(RecordatorioRequest.class)))
				.thenThrow(new RecordatorioInvalidoException("Un recordatorio no puede ser de una tarea y de un evento a la vez"));

		mvc.perform(post("/api/recordatorios").contentType(MediaType.APPLICATION_JSON).content("""
						{"tareaId":1,"eventoId":2,"fechaHora":"2098-03-10T10:00:00-03:00"}"""))
				.andExpect(status().isBadRequest());
	}

	@Test
	void postConTareaInexistenteDevuelve400ConElMensajeDeTarea() throws Exception {
		when(service.crear(any(RecordatorioRequest.class))).thenThrow(new TareaInvalidaException("La tarea no existe: 99"));

		mvc.perform(post("/api/recordatorios").contentType(MediaType.APPLICATION_JSON).content("""
						{"tareaId":99,"fechaHora":"2098-03-10T10:00:00-03:00"}"""))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.mensaje").value("La tarea no existe: 99"));
	}

	@Test
	void postConEventoInexistenteDevuelve400ConElMensajeDeEvento() throws Exception {
		when(service.crear(any(RecordatorioRequest.class))).thenThrow(new EventoInvalidoException("El evento no existe: 99"));

		mvc.perform(post("/api/recordatorios").contentType(MediaType.APPLICATION_JSON).content("""
						{"eventoId":99,"fechaHora":"2098-03-10T10:00:00-03:00"}"""))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.mensaje").value("El evento no existe: 99"));
	}

	@Test
	void postDeTareaConRecordatorioDevuelve409() throws Exception {
		when(service.crear(any(RecordatorioRequest.class)))
				.thenThrow(new RecordatorioConflictoException("La tarea 5 ya tiene un recordatorio"));

		mvc.perform(post("/api/recordatorios").contentType(MediaType.APPLICATION_JSON).content("""
						{"tareaId":5,"fechaHora":"2098-03-10T10:00:00-03:00"}"""))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.mensaje").value(containsString("5")));
	}

	// ---- Obtener ----

	@Test
	void getPorIdDevuelve200() throws Exception {
		when(service.obtener(1L)).thenReturn(respuesta(1L));

		mvc.perform(get("/api/recordatorios/1"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.id").value(1));
	}

	@Test
	void getInexistenteDevuelve404() throws Exception {
		when(service.obtener(9L)).thenThrow(new RecordatorioNoEncontradoException(9L));

		mvc.perform(get("/api/recordatorios/9"))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.mensaje").value(containsString("9")));
	}

	@Test
	void getConIdNoNumericoDevuelve400() throws Exception {
		mvc.perform(get("/api/recordatorios/abc")).andExpect(status().isBadRequest());
		verifyNoInteractions(service);
	}

	// ---- Listar ----

	@Test
	void getSinFiltrosLlamaAlServiceConNulls() throws Exception {
		when(service.listar(isNull(), isNull())).thenReturn(List.of(respuesta(1L), respuesta(2L)));

		mvc.perform(get("/api/recordatorios"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(2))
				.andExpect(jsonPath("$[0].id").value(1))
				.andExpect(jsonPath("$[1].id").value(2));
	}

	@Test
	void getConTareaIdYEventoIdLosPasaAlService() throws Exception {
		when(service.listar(5L, 8L)).thenReturn(List.of());

		mvc.perform(get("/api/recordatorios").param("tareaId", "5").param("eventoId", "8"))
				.andExpect(status().isOk());

		verify(service).listar(5L, 8L);
	}

	@Test
	void getConTareaIdNoNumericoDevuelve400() throws Exception {
		mvc.perform(get("/api/recordatorios").param("tareaId", "abc"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.mensaje").value(containsString("tareaId")));
		verifyNoInteractions(service);
	}

	@Test
	void getConEventoIdNoNumericoDevuelve400() throws Exception {
		mvc.perform(get("/api/recordatorios").param("eventoId", "xyz")).andExpect(status().isBadRequest());
		verifyNoInteractions(service);
	}

	// ---- Vencidos ----

	@Test
	void vencidosDevuelve200YPasaAhoraComoInstante() throws Exception {
		when(service.vencidos(any())).thenReturn(List.of(respuesta(1L)));

		mvc.perform(get("/api/recordatorios/vencidos").param("ahora", "2098-03-10T12:00:00-03:00"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[0].id").value(1));

		ArgumentCaptor<OffsetDateTime> captor = ArgumentCaptor.forClass(OffsetDateTime.class);
		verify(service).vencidos(captor.capture());
		assertThat(captor.getValue().toInstant()).isEqualTo(t("2098-03-10T15:00:00Z").toInstant());
	}

	@Test
	void vencidosSinAhoraDevuelve400() throws Exception {
		mvc.perform(get("/api/recordatorios/vencidos")).andExpect(status().isBadRequest());
		verifyNoInteractions(service);
	}

	@Test
	void vencidosConAhoraMalFormadoDevuelve400() throws Exception {
		mvc.perform(get("/api/recordatorios/vencidos").param("ahora", "abc"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.mensaje").value(containsString("ahora")));
		mvc.perform(get("/api/recordatorios/vencidos").param("ahora", "2098-03-10"))
				.andExpect(status().isBadRequest());
		verifyNoInteractions(service);
	}

	// ---- Actualizar ----

	@Test
	void putValidoDevuelve200() throws Exception {
		when(service.actualizar(any(), any(RecordatorioRequest.class))).thenReturn(respuesta(1L));

		mvc.perform(put("/api/recordatorios/1").contentType(MediaType.APPLICATION_JSON).content(CUERPO_VALIDO))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.id").value(1));
	}

	@Test
	void putInexistenteDevuelve404() throws Exception {
		when(service.actualizar(any(), any(RecordatorioRequest.class))).thenThrow(new RecordatorioNoEncontradoException(9L));

		mvc.perform(put("/api/recordatorios/9").contentType(MediaType.APPLICATION_JSON).content(CUERPO_VALIDO))
				.andExpect(status().isNotFound());
	}

	@Test
	void putSinFechaHoraDevuelve400() throws Exception {
		mvc.perform(put("/api/recordatorios/1").contentType(MediaType.APPLICATION_JSON).content("""
						{"descripcion":"x"}"""))
				.andExpect(status().isBadRequest());
		verifyNoInteractions(service);
	}

	@Test
	void putConCanalQueNoExisteDevuelve400() throws Exception {
		mvc.perform(put("/api/recordatorios/1").contentType(MediaType.APPLICATION_JSON).content("""
						{"fechaHora":"2098-03-10T10:00:00-03:00","canal":"raro","descripcion":"x"}"""))
				.andExpect(status().isBadRequest());
		verifyNoInteractions(service);
	}

	@Test
	void putCambiandoAUnVinculoYaOcupadoDevuelve409() throws Exception {
		when(service.actualizar(any(), any(RecordatorioRequest.class)))
				.thenThrow(new RecordatorioConflictoException("El evento 8 ya tiene un recordatorio"));

		mvc.perform(put("/api/recordatorios/1").contentType(MediaType.APPLICATION_JSON).content("""
						{"eventoId":8,"fechaHora":"2098-03-10T10:00:00-03:00"}"""))
				.andExpect(status().isConflict());
	}

	// ---- Marcar enviado ----

	@Test
	void marcarEnviadoDevuelve200() throws Exception {
		when(service.marcarEnviado(1L)).thenReturn(new RecordatorioResponse(1L, null, null,
				t("2098-03-10T10:00:00-03:00"), Canal.APP, true, "x"));

		mvc.perform(patch("/api/recordatorios/1/marcar-enviado"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.enviado").value(true));
	}

	@Test
	void marcarEnviadoInexistenteDevuelve404() throws Exception {
		when(service.marcarEnviado(9L)).thenThrow(new RecordatorioNoEncontradoException(9L));

		mvc.perform(patch("/api/recordatorios/9/marcar-enviado")).andExpect(status().isNotFound());
	}

	// ---- Borrar ----

	@Test
	void deleteDevuelve204() throws Exception {
		mvc.perform(delete("/api/recordatorios/1")).andExpect(status().isNoContent());

		verify(service).eliminar(1L);
	}

	@Test
	void deleteInexistenteDevuelve404() throws Exception {
		doThrow(new RecordatorioNoEncontradoException(9L)).when(service).eliminar(9L);

		mvc.perform(delete("/api/recordatorios/9")).andExpect(status().isNotFound());
	}
}
