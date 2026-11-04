package com.agoals.tarea;

import com.agoals.common.ApiExceptionHandler;
import com.agoals.tarea.dto.TareaRequest;
import com.agoals.tarea.dto.TareaResponse;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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
		return new TareaResponse(id, titulo, null, Estado.PENDIENTE, null, null, null, null, null, 0, null);
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
	void deleteInexistenteDevuelve404() throws Exception {
		doThrow(new TareaNoEncontradaException(7L)).when(service).eliminar(7L);

		mvc.perform(delete("/api/tareas/7")).andExpect(status().isNotFound());
	}
}
