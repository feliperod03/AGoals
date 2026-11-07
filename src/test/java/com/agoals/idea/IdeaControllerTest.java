package com.agoals.idea;

import com.agoals.common.ApiExceptionHandler;
import com.agoals.idea.dto.ConcluirRequest;
import com.agoals.idea.dto.IdeaRequest;
import com.agoals.idea.dto.IdeaResponse;
import com.agoals.objetivo.ObjetivoInvalidoException;
import com.agoals.proyecto.ProyectoInvalidoException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.OffsetDateTime;
import java.util.List;

import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(IdeaController.class)
@Import(ApiExceptionHandler.class)
class IdeaControllerTest {

	@Autowired
	MockMvc mvc;

	@MockitoBean
	IdeaService service;

	private static IdeaResponse respuesta(Long id, String titulo) {
		return new IdeaResponse(id, titulo, "", EstadoIdea.PLANTEADA, null, null, null,
				OffsetDateTime.parse("2026-11-07T10:00:00Z"), null);
	}

	// ---- Crear ----

	@Test
	void postValidoDevuelve201ConFechaDeCreacion() throws Exception {
		when(service.crear(any(IdeaRequest.class))).thenReturn(respuesta(1L, "Una idea"));

		mvc.perform(post("/api/ideas").contentType(MediaType.APPLICATION_JSON)
						.content("{\"titulo\":\"Una idea\",\"proyectoId\":2}"))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.id").value(1))
				.andExpect(jsonPath("$.titulo").value("Una idea"))
				.andExpect(jsonPath("$.estado").value("PLANTEADA"))
				.andExpect(jsonPath("$.fechaCreacion").isNotEmpty());
	}

	@Test
	void postPasaTodosLosCamposAlService() throws Exception {
		when(service.crear(any(IdeaRequest.class))).thenReturn(respuesta(1L, "Una idea"));

		mvc.perform(post("/api/ideas").contentType(MediaType.APPLICATION_JSON)
				.content("{\"titulo\":\"Una idea\",\"descripcion\":\"d\",\"objetivoId\":3,\"conclusion\":\"c\"}"));

		verify(service).crear(new IdeaRequest("Una idea", "d", null, 3L, "c"));
	}

	@Test
	void postSinTituloDevuelve400() throws Exception {
		mvc.perform(post("/api/ideas").contentType(MediaType.APPLICATION_JSON).content("{\"titulo\":\"\"}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.errores[0]").value(containsString("titulo")));

		verify(service, never()).crear(any());
	}

	@Test
	void postConTituloDeMasDe200CaracteresDevuelve400() throws Exception {
		String largo = "x".repeat(201);

		mvc.perform(post("/api/ideas").contentType(MediaType.APPLICATION_JSON)
						.content("{\"titulo\":\"" + largo + "\"}"))
				.andExpect(status().isBadRequest());

		verify(service, never()).crear(any());
	}

	@Test
	void postConProyectoYObjetivoDevuelve400() throws Exception {
		when(service.crear(any(IdeaRequest.class)))
				.thenThrow(new IdeaInvalidaException("Una idea no puede estar ligada a un proyecto y a un objetivo a la vez"));

		mvc.perform(post("/api/ideas").contentType(MediaType.APPLICATION_JSON)
						.content("{\"titulo\":\"x\",\"proyectoId\":1,\"objetivoId\":2}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.mensaje").value(containsString("a la vez")));
	}

	@Test
	void postConProyectoInexistenteDevuelve400() throws Exception {
		when(service.crear(any(IdeaRequest.class))).thenThrow(new ProyectoInvalidoException("El proyecto no existe: 9"));

		mvc.perform(post("/api/ideas").contentType(MediaType.APPLICATION_JSON)
						.content("{\"titulo\":\"x\",\"proyectoId\":9}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.mensaje").value("El proyecto no existe: 9"));
	}

	@Test
	void postConObjetivoInexistenteDevuelve400() throws Exception {
		when(service.crear(any(IdeaRequest.class))).thenThrow(new ObjetivoInvalidoException("El objetivo no existe: 9"));

		mvc.perform(post("/api/ideas").contentType(MediaType.APPLICATION_JSON)
						.content("{\"titulo\":\"x\",\"objetivoId\":9}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.mensaje").value("El objetivo no existe: 9"));
	}

	// ---- Obtener / listar ----

	@Test
	void getPorIdDevuelve200() throws Exception {
		when(service.obtener(1L)).thenReturn(respuesta(1L, "Una idea"));

		mvc.perform(get("/api/ideas/1"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.titulo").value("Una idea"));
	}

	@Test
	void getInexistenteDevuelve404() throws Exception {
		when(service.obtener(7L)).thenThrow(new IdeaNoEncontradaException(7L));

		mvc.perform(get("/api/ideas/7"))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.mensaje").value("No existe la idea con id 7"));
	}

	@Test
	void getListaSinFiltros() throws Exception {
		when(service.listar(null, null, null, null)).thenReturn(List.of(respuesta(2L, "b"), respuesta(1L, "a")));

		mvc.perform(get("/api/ideas"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(2))
				.andExpect(jsonPath("$[0].id").value(2));
	}

	@Test
	void getListaPasaLosFiltros() throws Exception {
		when(service.listar(EstadoIdea.CONCLUIDA, 4L, null, null)).thenReturn(List.of(respuesta(1L, "a")));

		mvc.perform(get("/api/ideas?estado=CONCLUIDA&proyectoId=4"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(1));
	}

	@Test
	void getListaConLibresPasaElFiltro() throws Exception {
		when(service.listar(null, null, null, true)).thenReturn(List.of(respuesta(1L, "a")));

		mvc.perform(get("/api/ideas?libres=true"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(1));
	}

	@Test
	void getLibresConProyectoIdDevuelve400() throws Exception {
		when(service.listar(null, 4L, null, true))
				.thenThrow(new IdeaInvalidaException("'libres=true' no se puede combinar con proyectoId ni objetivoId"));

		mvc.perform(get("/api/ideas?libres=true&proyectoId=4"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.mensaje").value(containsString("libres")));
	}

	@Test
	void getConEstadoInvalidoDevuelve400ConMensajeClaro() throws Exception {
		mvc.perform(get("/api/ideas?estado=RARO"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.mensaje").value(containsString("estado")))
				.andExpect(jsonPath("$.mensaje").value(containsString("RARO")))
				.andExpect(jsonPath("$.mensaje").value(containsString("PLANTEADA, CONCLUIDA")));
	}

	// ---- Actualizar ----

	@Test
	void putDevuelve200() throws Exception {
		when(service.actualizar(any(), any(IdeaRequest.class))).thenReturn(respuesta(1L, "Nuevo"));

		mvc.perform(put("/api/ideas/1").contentType(MediaType.APPLICATION_JSON).content("{\"titulo\":\"Nuevo\"}"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.titulo").value("Nuevo"));
	}

	@Test
	void putInexistenteDevuelve404() throws Exception {
		when(service.actualizar(any(), any(IdeaRequest.class))).thenThrow(new IdeaNoEncontradaException(7L));

		mvc.perform(put("/api/ideas/7").contentType(MediaType.APPLICATION_JSON).content("{\"titulo\":\"x\"}"))
				.andExpect(status().isNotFound());
	}

	@Test
	void putSinTituloDevuelve400() throws Exception {
		mvc.perform(put("/api/ideas/1").contentType(MediaType.APPLICATION_JSON).content("{}"))
				.andExpect(status().isBadRequest());
	}

	@Test
	void putConProyectoYObjetivoDevuelve400() throws Exception {
		when(service.actualizar(any(), any(IdeaRequest.class))).thenThrow(new IdeaInvalidaException("a la vez"));

		mvc.perform(put("/api/ideas/1").contentType(MediaType.APPLICATION_JSON)
						.content("{\"titulo\":\"x\",\"proyectoId\":1,\"objetivoId\":2}"))
				.andExpect(status().isBadRequest());
	}

	// ---- Eliminar ----

	@Test
	void deleteDevuelve204() throws Exception {
		mvc.perform(delete("/api/ideas/1")).andExpect(status().isNoContent());

		verify(service).eliminar(1L);
	}

	@Test
	void deleteInexistenteDevuelve404() throws Exception {
		doThrow(new IdeaNoEncontradaException(7L)).when(service).eliminar(7L);

		mvc.perform(delete("/api/ideas/7")).andExpect(status().isNotFound());
	}

	// ---- Concluir ----

	@Test
	void patchConcluirConCuerpoDevuelve200() throws Exception {
		IdeaResponse concluida = new IdeaResponse(1L, "t", "", EstadoIdea.CONCLUIDA, "listo", null, null,
				OffsetDateTime.parse("2026-11-07T10:00:00Z"), OffsetDateTime.parse("2026-11-08T10:00:00Z"));
		when(service.concluir(1L, new ConcluirRequest("listo"))).thenReturn(concluida);

		mvc.perform(patch("/api/ideas/1/concluir").contentType(MediaType.APPLICATION_JSON)
						.content("{\"conclusion\":\"listo\"}"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.estado").value("CONCLUIDA"))
				.andExpect(jsonPath("$.conclusion").value("listo"))
				.andExpect(jsonPath("$.fechaCierre").isNotEmpty());
	}

	@Test
	void patchConcluirSinCuerpoDevuelve200() throws Exception {
		IdeaResponse concluida = new IdeaResponse(1L, "t", "", EstadoIdea.CONCLUIDA, "anterior", null, null,
				OffsetDateTime.parse("2026-11-07T10:00:00Z"), OffsetDateTime.parse("2026-11-08T10:00:00Z"));
		when(service.concluir(1L, null)).thenReturn(concluida);

		mvc.perform(patch("/api/ideas/1/concluir"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.estado").value("CONCLUIDA"))
				.andExpect(jsonPath("$.conclusion").value("anterior"));

		verify(service).concluir(1L, null);
	}

	@Test
	void patchConcluirYaConcluidaDevuelve409() throws Exception {
		when(service.concluir(any(), any())).thenThrow(new IdeaEstadoInvalidaException("La idea 1 ya está concluida"));

		mvc.perform(patch("/api/ideas/1/concluir"))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.mensaje").value(containsString("ya está concluida")));
	}

	@Test
	void patchConcluirInexistenteDevuelve404() throws Exception {
		when(service.concluir(any(), any())).thenThrow(new IdeaNoEncontradaException(7L));

		mvc.perform(patch("/api/ideas/7/concluir")).andExpect(status().isNotFound());
	}

	// ---- Reabrir ----

	@Test
	void patchReabrirDevuelve200() throws Exception {
		when(service.reabrir(1L)).thenReturn(respuesta(1L, "t"));

		mvc.perform(patch("/api/ideas/1/reabrir"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.estado").value("PLANTEADA"));
	}

	@Test
	void patchReabrirInexistenteDevuelve404() throws Exception {
		when(service.reabrir(7L)).thenThrow(new IdeaNoEncontradaException(7L));

		mvc.perform(patch("/api/ideas/7/reabrir")).andExpect(status().isNotFound());
	}
}
