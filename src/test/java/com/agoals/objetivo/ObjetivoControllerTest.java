package com.agoals.objetivo;

import com.agoals.common.ApiExceptionHandler;
import com.agoals.common.Estado;
import com.agoals.common.Prioridad;
import com.agoals.objetivo.dto.ObjetivoRequest;
import com.agoals.objetivo.dto.ObjetivoResponse;
import com.agoals.tarea.TareaNoEncontradaException;
import com.agoals.tarea.dto.TareaResponse;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(ObjetivoController.class)
@Import(ApiExceptionHandler.class)
class ObjetivoControllerTest {

	@Autowired
	MockMvc mvc;

	@MockitoBean
	ObjetivoService service;

	private static ObjetivoResponse respuesta(Long id, String nombre) {
		return new ObjetivoResponse(id, nombre, "", Estado.PENDIENTE, null, null, null);
	}

	private static TareaResponse tarea(Long id, Long objetivoId) {
		return new TareaResponse(id, "t", null, Estado.PENDIENTE, null, null, null, null, null, null, objetivoId, 0, null);
	}

	// ---- Crear ----

	@Test
	void postValidoDevuelve201() throws Exception {
		when(service.crear(any(ObjetivoRequest.class))).thenReturn(respuesta(1L, "Inglés"));

		mvc.perform(post("/api/objetivos").contentType(MediaType.APPLICATION_JSON)
						.content("{\"nombre\":\"Inglés\",\"prioridad\":\"ALTA\",\"padreId\":2}"))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.id").value(1))
				.andExpect(jsonPath("$.nombre").value("Inglés"))
				.andExpect(jsonPath("$.estado").value("PENDIENTE"));
	}

	@Test
	void postPasaTodosLosCamposAlService() throws Exception {
		when(service.crear(any(ObjetivoRequest.class))).thenReturn(respuesta(1L, "Inglés"));

		mvc.perform(post("/api/objetivos").contentType(MediaType.APPLICATION_JSON)
				.content("{\"nombre\":\"Inglés\",\"estado\":\"EN_PAUSA\",\"prioridad\":\"ALTA\",\"padreId\":2}"));

		verify(service).crear(new ObjetivoRequest("Inglés", null, Estado.EN_PAUSA, Prioridad.ALTA, 2L));
	}

	@Test
	void postConNombreVacioDevuelve400() throws Exception {
		mvc.perform(post("/api/objetivos").contentType(MediaType.APPLICATION_JSON)
						.content("{\"nombre\":\"\"}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.errores[0]").value(containsString("nombre")));
		verify(service, never()).crear(any());
	}

	@Test
	void postConNombreDemasiadoLargoDevuelve400() throws Exception {
		mvc.perform(post("/api/objetivos").contentType(MediaType.APPLICATION_JSON)
						.content("{\"nombre\":\"" + "x".repeat(151) + "\"}"))
				.andExpect(status().isBadRequest());
	}

	@Test
	void postConEstadoInexistenteDevuelve400() throws Exception {
		mvc.perform(post("/api/objetivos").contentType(MediaType.APPLICATION_JSON)
						.content("{\"nombre\":\"x\",\"estado\":\"NOPE\"}"))
				.andExpect(status().isBadRequest());
	}

	@Test
	void postConPadreInexistenteDevuelve400() throws Exception {
		when(service.crear(any(ObjetivoRequest.class)))
				.thenThrow(new ObjetivoInvalidoException("El objetivo padre no existe: 9"));

		mvc.perform(post("/api/objetivos").contentType(MediaType.APPLICATION_JSON)
						.content("{\"nombre\":\"x\",\"padreId\":9}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.mensaje").value("El objetivo padre no existe: 9"));
	}

	// ---- Leer ----

	@Test
	void getPorIdDevuelve200() throws Exception {
		when(service.obtener(1L)).thenReturn(respuesta(1L, "Inglés"));

		mvc.perform(get("/api/objetivos/1"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.nombre").value("Inglés"));
	}

	@Test
	void getPorIdInexistenteDevuelve404() throws Exception {
		when(service.obtener(7L)).thenThrow(new ObjetivoNoEncontradoException(7L));

		mvc.perform(get("/api/objetivos/7"))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.mensaje").value("No existe el objetivo con id 7"));
	}

	@Test
	void getListaSinFiltroPasaNull() throws Exception {
		when(service.listar(null)).thenReturn(List.of(respuesta(1L, "a"), respuesta(2L, "b")));

		mvc.perform(get("/api/objetivos"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(2))
				.andExpect(jsonPath("$[1].nombre").value("b"));
	}

	@Test
	void getListaConFiltroLoPasaAlService() throws Exception {
		when(service.listar(Estado.EN_PROGRESO)).thenReturn(List.of(respuesta(1L, "a")));

		mvc.perform(get("/api/objetivos").param("estado", "EN_PROGRESO"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(1));
		verify(service).listar(Estado.EN_PROGRESO);
	}

	@Test
	void getListaConEstadoInvalidoDevuelve400() throws Exception {
		mvc.perform(get("/api/objetivos").param("estado", "NOPE")).andExpect(status().isBadRequest());
	}

	// ---- Actualizar / borrar ----

	@Test
	void putValidoDevuelve200() throws Exception {
		when(service.actualizar(eq(1L), any(ObjetivoRequest.class))).thenReturn(respuesta(1L, "nuevo"));

		mvc.perform(put("/api/objetivos/1").contentType(MediaType.APPLICATION_JSON)
						.content("{\"nombre\":\"nuevo\"}"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.nombre").value("nuevo"));
	}

	@Test
	void putInexistenteDevuelve404() throws Exception {
		when(service.actualizar(eq(7L), any(ObjetivoRequest.class))).thenThrow(new ObjetivoNoEncontradoException(7L));

		mvc.perform(put("/api/objetivos/7").contentType(MediaType.APPLICATION_JSON)
						.content("{\"nombre\":\"x\"}"))
				.andExpect(status().isNotFound());
	}

	@Test
	void putQueCreaUnCicloDevuelve400() throws Exception {
		when(service.actualizar(eq(1L), any(ObjetivoRequest.class)))
				.thenThrow(new ObjetivoInvalidoException("Ciclo en la jerarquía"));

		mvc.perform(put("/api/objetivos/1").contentType(MediaType.APPLICATION_JSON)
						.content("{\"nombre\":\"x\",\"padreId\":3}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.mensaje").value(containsString("Ciclo")));
	}

	@Test
	void putConNombreVacioDevuelve400() throws Exception {
		mvc.perform(put("/api/objetivos/1").contentType(MediaType.APPLICATION_JSON)
						.content("{\"nombre\":\" \"}"))
				.andExpect(status().isBadRequest());
	}

	@Test
	void deleteDevuelve204() throws Exception {
		mvc.perform(delete("/api/objetivos/1")).andExpect(status().isNoContent());

		verify(service).eliminar(1L);
	}

	@Test
	void deleteInexistenteDevuelve404() throws Exception {
		doThrow(new ObjetivoNoEncontradoException(7L)).when(service).eliminar(7L);

		mvc.perform(delete("/api/objetivos/7")).andExpect(status().isNotFound());
	}

	@Test
	void deleteConDependenciasDevuelve409ConElMotivo() throws Exception {
		doThrow(new ObjetivoConDependenciasException("El objetivo 1 tiene proyectos: cámbiales el objetivo o bórralos primero"))
				.when(service).eliminar(1L);

		mvc.perform(delete("/api/objetivos/1"))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.mensaje").value(containsString("proyectos")));
	}

	@Test
	void deleteConIdeasDevuelve409ConElMotivo() throws Exception {
		doThrow(new ObjetivoConDependenciasException("El objetivo 1 tiene ideas: desvincúlalas o bórralas primero"))
				.when(service).eliminar(1L);

		mvc.perform(delete("/api/objetivos/1"))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.mensaje").value(containsString("ideas")));
	}

	// ---- Tareas del objetivo ----

	@Test
	void getTareasDelObjetivoDevuelveLista() throws Exception {
		when(service.listarTareas(1L)).thenReturn(List.of(tarea(5L, 1L), tarea(6L, 1L)));

		mvc.perform(get("/api/objetivos/1/tareas"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(2))
				.andExpect(jsonPath("$[0].objetivoId").value(1));
	}

	@Test
	void getTareasDeObjetivoInexistenteDevuelve404() throws Exception {
		when(service.listarTareas(7L)).thenThrow(new ObjetivoNoEncontradoException(7L));

		mvc.perform(get("/api/objetivos/7/tareas")).andExpect(status().isNotFound());
	}

	@Test
	void putAsignarTareaDevuelve200ConLaTarea() throws Exception {
		when(service.asignarTarea(1L, 5L)).thenReturn(tarea(5L, 1L));

		mvc.perform(put("/api/objetivos/1/tareas/5"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.id").value(5))
				.andExpect(jsonPath("$.objetivoId").value(1));
	}

	@Test
	void putAsignarTareaAObjetivoInexistenteDevuelve404() throws Exception {
		when(service.asignarTarea(7L, 5L)).thenThrow(new ObjetivoNoEncontradoException(7L));

		mvc.perform(put("/api/objetivos/7/tareas/5")).andExpect(status().isNotFound());
	}

	@Test
	void putAsignarTareaInexistenteDevuelve404() throws Exception {
		when(service.asignarTarea(1L, 99L)).thenThrow(new TareaNoEncontradaException(99L));

		mvc.perform(put("/api/objetivos/1/tareas/99")).andExpect(status().isNotFound());
	}

	@Test
	void deleteDesasignarTareaDevuelve204() throws Exception {
		mvc.perform(delete("/api/objetivos/1/tareas/5")).andExpect(status().isNoContent());

		verify(service).desasignarTarea(1L, 5L);
	}

	@Test
	void deleteDesasignarTareaAjenaDevuelve400() throws Exception {
		doThrow(new ObjetivoInvalidoException("La tarea 5 no pertenece al objetivo 1"))
				.when(service).desasignarTarea(1L, 5L);

		mvc.perform(delete("/api/objetivos/1/tareas/5")).andExpect(status().isBadRequest());
	}
}
