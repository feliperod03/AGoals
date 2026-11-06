package com.agoals.proyecto;

import com.agoals.common.ApiExceptionHandler;
import com.agoals.common.Estado;
import com.agoals.common.Prioridad;
import com.agoals.objetivo.ObjetivoInvalidoException;
import com.agoals.proyecto.dto.ProyectoRequest;
import com.agoals.proyecto.dto.ProyectoResponse;
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

@WebMvcTest(ProyectoController.class)
@Import(ApiExceptionHandler.class)
class ProyectoControllerTest {

	@Autowired
	MockMvc mvc;

	@MockitoBean
	ProyectoService service;

	private static ProyectoResponse respuesta(Long id, String nombre) {
		return new ProyectoResponse(id, nombre, "", Estado.PENDIENTE, null, null, null, null);
	}

	private static TareaResponse tarea(Long id, Long proyectoId) {
		return new TareaResponse(id, "t", null, Estado.PENDIENTE, null, null, null, null, null, proyectoId, null, 0, null);
	}

	// ---- Crear ----

	@Test
	void postValidoDevuelve201() throws Exception {
		when(service.crear(any(ProyectoRequest.class))).thenReturn(respuesta(1L, "Casa"));

		mvc.perform(post("/api/proyectos").contentType(MediaType.APPLICATION_JSON)
						.content("{\"nombre\":\"Casa\",\"prioridad\":\"ALTA\",\"padreId\":2,\"objetivoId\":3}"))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.id").value(1))
				.andExpect(jsonPath("$.nombre").value("Casa"))
				.andExpect(jsonPath("$.estado").value("PENDIENTE"));
	}

	@Test
	void postPasaTodosLosCamposAlService() throws Exception {
		when(service.crear(any(ProyectoRequest.class))).thenReturn(respuesta(1L, "Casa"));

		mvc.perform(post("/api/proyectos").contentType(MediaType.APPLICATION_JSON)
				.content("{\"nombre\":\"Casa\",\"estado\":\"EN_PAUSA\",\"prioridad\":\"ALTA\",\"padreId\":2,\"objetivoId\":3}"));

		verify(service).crear(new ProyectoRequest("Casa", null, Estado.EN_PAUSA, Prioridad.ALTA, 2L, 3L));
	}

	@Test
	void postConNombreVacioDevuelve400() throws Exception {
		mvc.perform(post("/api/proyectos").contentType(MediaType.APPLICATION_JSON)
						.content("{\"nombre\":\"\"}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.errores[0]").value(containsString("nombre")));
		verify(service, never()).crear(any());
	}

	@Test
	void postConNombreDemasiadoLargoDevuelve400() throws Exception {
		mvc.perform(post("/api/proyectos").contentType(MediaType.APPLICATION_JSON)
						.content("{\"nombre\":\"" + "x".repeat(151) + "\"}"))
				.andExpect(status().isBadRequest());
	}

	@Test
	void postConEstadoInexistenteDevuelve400() throws Exception {
		mvc.perform(post("/api/proyectos").contentType(MediaType.APPLICATION_JSON)
						.content("{\"nombre\":\"x\",\"estado\":\"NOPE\"}"))
				.andExpect(status().isBadRequest());
	}

	@Test
	void postConReglaInvalidaDevuelve400() throws Exception {
		when(service.crear(any(ProyectoRequest.class)))
				.thenThrow(new ProyectoInvalidoException("El proyecto padre no existe: 9"));

		mvc.perform(post("/api/proyectos").contentType(MediaType.APPLICATION_JSON)
						.content("{\"nombre\":\"x\",\"padreId\":9}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.mensaje").value("El proyecto padre no existe: 9"));
	}

	@Test
	void postConObjetivoInexistenteDevuelve400() throws Exception {
		when(service.crear(any(ProyectoRequest.class)))
				.thenThrow(new ObjetivoInvalidoException("El objetivo no existe: 77"));

		mvc.perform(post("/api/proyectos").contentType(MediaType.APPLICATION_JSON)
						.content("{\"nombre\":\"x\",\"objetivoId\":77}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.mensaje").value("El objetivo no existe: 77"));
	}

	@Test
	void putConObjetivoInexistenteDevuelve400() throws Exception {
		when(service.actualizar(eq(1L), any(ProyectoRequest.class)))
				.thenThrow(new ObjetivoInvalidoException("El objetivo no existe: 77"));

		mvc.perform(put("/api/proyectos/1").contentType(MediaType.APPLICATION_JSON)
						.content("{\"nombre\":\"x\",\"objetivoId\":77}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.mensaje").value("El objetivo no existe: 77"));
	}

	// ---- Leer ----

	@Test
	void getPorIdDevuelve200() throws Exception {
		when(service.obtener(1L)).thenReturn(respuesta(1L, "Casa"));

		mvc.perform(get("/api/proyectos/1"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.nombre").value("Casa"));
	}

	@Test
	void getPorIdInexistenteDevuelve404() throws Exception {
		when(service.obtener(7L)).thenThrow(new ProyectoNoEncontradoException(7L));

		mvc.perform(get("/api/proyectos/7"))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.mensaje").value("No existe el proyecto con id 7"));
	}

	@Test
	void getListaSinFiltrosPasaNulls() throws Exception {
		when(service.listar(null, null)).thenReturn(List.of(respuesta(1L, "a"), respuesta(2L, "b")));

		mvc.perform(get("/api/proyectos"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(2))
				.andExpect(jsonPath("$[1].nombre").value("b"));
	}

	@Test
	void getListaConFiltrosLosPasaAlService() throws Exception {
		when(service.listar(Estado.EN_PROGRESO, 3L)).thenReturn(List.of(respuesta(1L, "a")));

		mvc.perform(get("/api/proyectos").param("estado", "EN_PROGRESO").param("objetivoId", "3"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(1));
		verify(service).listar(Estado.EN_PROGRESO, 3L);
	}

	@Test
	void getListaConEstadoInvalidoDevuelve400() throws Exception {
		mvc.perform(get("/api/proyectos").param("estado", "NOPE")).andExpect(status().isBadRequest());
	}

	@Test
	void getListaConObjetivoIdNoNumericoDevuelve400() throws Exception {
		mvc.perform(get("/api/proyectos").param("objetivoId", "abc")).andExpect(status().isBadRequest());
	}

	// ---- Actualizar / borrar ----

	@Test
	void putValidoDevuelve200() throws Exception {
		when(service.actualizar(eq(1L), any(ProyectoRequest.class))).thenReturn(respuesta(1L, "nuevo"));

		mvc.perform(put("/api/proyectos/1").contentType(MediaType.APPLICATION_JSON)
						.content("{\"nombre\":\"nuevo\"}"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.nombre").value("nuevo"));
	}

	@Test
	void putInexistenteDevuelve404() throws Exception {
		when(service.actualizar(eq(7L), any(ProyectoRequest.class))).thenThrow(new ProyectoNoEncontradoException(7L));

		mvc.perform(put("/api/proyectos/7").contentType(MediaType.APPLICATION_JSON)
						.content("{\"nombre\":\"x\"}"))
				.andExpect(status().isNotFound());
	}

	@Test
	void putQueCreaUnCicloDevuelve400() throws Exception {
		when(service.actualizar(eq(1L), any(ProyectoRequest.class)))
				.thenThrow(new ProyectoInvalidoException("Ciclo en la jerarquía"));

		mvc.perform(put("/api/proyectos/1").contentType(MediaType.APPLICATION_JSON)
						.content("{\"nombre\":\"x\",\"padreId\":3}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.mensaje").value(containsString("Ciclo")));
	}

	@Test
	void putConNombreVacioDevuelve400() throws Exception {
		mvc.perform(put("/api/proyectos/1").contentType(MediaType.APPLICATION_JSON)
						.content("{\"nombre\":\" \"}"))
				.andExpect(status().isBadRequest());
	}

	@Test
	void deleteDevuelve204() throws Exception {
		mvc.perform(delete("/api/proyectos/1")).andExpect(status().isNoContent());

		verify(service).eliminar(1L);
	}

	@Test
	void deleteInexistenteDevuelve404() throws Exception {
		doThrow(new ProyectoNoEncontradoException(7L)).when(service).eliminar(7L);

		mvc.perform(delete("/api/proyectos/7")).andExpect(status().isNotFound());
	}

	@Test
	void deleteConHijosOTareasDevuelve409() throws Exception {
		doThrow(new ProyectoConDependenciasException("El proyecto 1 tiene tareas: desasígnalas primero"))
				.when(service).eliminar(1L);

		mvc.perform(delete("/api/proyectos/1"))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.mensaje").value(containsString("tareas")));
	}

	// ---- Tareas del proyecto ----

	@Test
	void getTareasDelProyectoDevuelveLista() throws Exception {
		when(service.listarTareas(1L)).thenReturn(List.of(tarea(5L, 1L), tarea(6L, 1L)));

		mvc.perform(get("/api/proyectos/1/tareas"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(2))
				.andExpect(jsonPath("$[0].proyectoId").value(1));
	}

	@Test
	void getTareasDeProyectoInexistenteDevuelve404() throws Exception {
		when(service.listarTareas(7L)).thenThrow(new ProyectoNoEncontradoException(7L));

		mvc.perform(get("/api/proyectos/7/tareas")).andExpect(status().isNotFound());
	}

	@Test
	void putAsignarTareaDevuelve200ConLaTarea() throws Exception {
		when(service.asignarTarea(1L, 5L)).thenReturn(tarea(5L, 1L));

		mvc.perform(put("/api/proyectos/1/tareas/5"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.id").value(5))
				.andExpect(jsonPath("$.proyectoId").value(1));
	}

	@Test
	void putAsignarTareaAProyectoInexistenteDevuelve404() throws Exception {
		when(service.asignarTarea(7L, 5L)).thenThrow(new ProyectoNoEncontradoException(7L));

		mvc.perform(put("/api/proyectos/7/tareas/5")).andExpect(status().isNotFound());
	}

	@Test
	void putAsignarTareaInexistenteDevuelve404() throws Exception {
		when(service.asignarTarea(1L, 99L)).thenThrow(new TareaNoEncontradaException(99L));

		mvc.perform(put("/api/proyectos/1/tareas/99")).andExpect(status().isNotFound());
	}

	@Test
	void deleteDesasignarTareaDevuelve204() throws Exception {
		mvc.perform(delete("/api/proyectos/1/tareas/5")).andExpect(status().isNoContent());

		verify(service).desasignarTarea(1L, 5L);
	}

	@Test
	void deleteDesasignarTareaAjenaDevuelve400() throws Exception {
		doThrow(new ProyectoInvalidoException("La tarea 5 no pertenece al proyecto 1"))
				.when(service).desasignarTarea(1L, 5L);

		mvc.perform(delete("/api/proyectos/1/tareas/5")).andExpect(status().isBadRequest());
	}
}
