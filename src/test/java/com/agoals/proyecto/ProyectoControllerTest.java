package com.agoals.proyecto;

import com.agoals.common.ApiExceptionHandler;
import com.agoals.common.ConteoBorrado;
import com.agoals.common.Estado;
import com.agoals.common.ModoBorrado;
import com.agoals.common.Prioridad;
import com.agoals.objetivo.ObjetivoInvalidoException;
import com.agoals.proyecto.dto.ImpactoBorradoProyectoResponse;
import com.agoals.proyecto.dto.ProyectoRequest;
import com.agoals.proyecto.dto.ProyectoResponse;
import com.agoals.tarea.TareaNoEncontradaException;
import com.agoals.tarea.dto.TareaResponse;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
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
import static org.mockito.Mockito.verifyNoInteractions;
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
	void deleteSinParametrosLlamaConNingunaEleccionYDevuelve204() throws Exception {
		mvc.perform(delete("/api/proyectos/1")).andExpect(status().isNoContent());

		verify(service).eliminar(1L, EleccionesBorradoProyecto.NINGUNA);
	}

	@Test
	void deleteConParametrosVaciosSeTrataComoAusentes() throws Exception {
		mvc.perform(delete("/api/proyectos/1?subproyectos=&tareas=&ideas=")).andExpect(status().isNoContent());

		verify(service).eliminar(1L, EleccionesBorradoProyecto.NINGUNA);
	}

	@ParameterizedTest
	@CsvSource({ "borrar,BORRAR", "BORRAR,BORRAR", "conservar,CONSERVAR", "Conservar,CONSERVAR" })
	void deleteConCadaParametroValidoLlegaAlServiceConElEnumSoloEnSuCategoria(String texto, ModoBorrado esperado)
			throws Exception {
		mvc.perform(delete("/api/proyectos/1?subproyectos=" + texto)).andExpect(status().isNoContent());
		mvc.perform(delete("/api/proyectos/2?tareas=" + texto)).andExpect(status().isNoContent());
		mvc.perform(delete("/api/proyectos/3?ideas=" + texto)).andExpect(status().isNoContent());

		verify(service).eliminar(1L, new EleccionesBorradoProyecto(esperado, null, null));
		verify(service).eliminar(2L, new EleccionesBorradoProyecto(null, esperado, null));
		verify(service).eliminar(3L, new EleccionesBorradoProyecto(null, null, esperado));
	}

	@Test
	void deleteConVariosParametrosLosPasaTodosJuntos() throws Exception {
		mvc.perform(delete("/api/proyectos/1?subproyectos=conservar&tareas=borrar&ideas=conservar"))
				.andExpect(status().isNoContent());

		verify(service).eliminar(1L, new EleccionesBorradoProyecto(ModoBorrado.CONSERVAR, ModoBorrado.BORRAR,
				ModoBorrado.CONSERVAR));
	}

	@ParameterizedTest
	@CsvSource({ "subproyectos", "tareas", "ideas" })
	void deleteConUnValorInvalidoDevuelve400ConElParametroYNoLlamaAlService(String parametro) throws Exception {
		mvc.perform(delete("/api/proyectos/1?" + parametro + "=raro"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.mensaje").value(containsString(parametro + " inválido")))
				.andExpect(jsonPath("$.mensaje").value(containsString("borrar o conservar")));

		verifyNoInteractions(service);
	}

	@Test
	void deleteInexistenteDevuelve404() throws Exception {
		doThrow(new ProyectoNoEncontradoException(7L)).when(service).eliminar(7L, EleccionesBorradoProyecto.NINGUNA);

		mvc.perform(delete("/api/proyectos/7")).andExpect(status().isNotFound());
	}

	@Test
	void deleteConTareasSinEleccionDevuelve409ConElNombre() throws Exception {
		doThrow(new ProyectoConDependenciasException("El proyecto «Casa» tiene tareas: indica si quieres borrarlas o conservarlas"))
				.when(service).eliminar(1L, EleccionesBorradoProyecto.NINGUNA);

		mvc.perform(delete("/api/proyectos/1"))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.mensaje").value(containsString("«Casa» tiene tareas")));
	}

	@Test
	void deleteConSubproyectosOIdeasSinEleccionDevuelve409ConElMotivo() throws Exception {
		doThrow(new ProyectoConDependenciasException("El proyecto «Casa» tiene ideas: indica si quieres borrarlas o conservarlas"))
				.when(service).eliminar(1L, EleccionesBorradoProyecto.NINGUNA);

		mvc.perform(delete("/api/proyectos/1"))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.mensaje").value(containsString("«Casa» tiene ideas")));
	}

	// ---- Vista previa del impacto del borrado (5f) ----

	@Test
	void impactoBorradoDevuelve200ConLaFormaDelContrato() throws Exception {
		when(service.impactoBorrado(1L, new EleccionesBorradoProyecto(ModoBorrado.BORRAR, ModoBorrado.BORRAR, null)))
				.thenReturn(new ImpactoBorradoProyectoResponse(new ConteoBorrado(2, 3), new ConteoBorrado(4, 6),
						new ConteoBorrado(1, 0)));

		mvc.perform(get("/api/proyectos/1/impacto-borrado?subproyectos=borrar&tareas=borrar"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.subproyectos.total").value(2))
				.andExpect(jsonPath("$.subproyectos.borrados").value(3))
				.andExpect(jsonPath("$.tareas.total").value(4))
				.andExpect(jsonPath("$.tareas.borrados").value(6))
				.andExpect(jsonPath("$.ideas.total").value(1))
				.andExpect(jsonPath("$.ideas.borrados").value(0));
	}

	@Test
	void impactoBorradoSinParametrosLlegaAlServiceSinElecciones() throws Exception {
		when(service.impactoBorrado(1L, EleccionesBorradoProyecto.NINGUNA)).thenReturn(
				new ImpactoBorradoProyectoResponse(new ConteoBorrado(0, 0), new ConteoBorrado(0, 0),
						new ConteoBorrado(0, 0)));

		mvc.perform(get("/api/proyectos/1/impacto-borrado")).andExpect(status().isOk());

		verify(service).impactoBorrado(1L, EleccionesBorradoProyecto.NINGUNA);
	}

	@Test
	void impactoBorradoConParametrosVaciosEquivaleAAusentes() throws Exception {
		when(service.impactoBorrado(1L, EleccionesBorradoProyecto.NINGUNA)).thenReturn(
				new ImpactoBorradoProyectoResponse(new ConteoBorrado(0, 0), new ConteoBorrado(0, 0),
						new ConteoBorrado(0, 0)));

		mvc.perform(get("/api/proyectos/1/impacto-borrado?subproyectos=&tareas=&ideas=")).andExpect(status().isOk());

		verify(service).impactoBorrado(1L, EleccionesBorradoProyecto.NINGUNA);
	}

	@ParameterizedTest
	@CsvSource({ "borrar,BORRAR", "BORRAR,BORRAR", "conservar,CONSERVAR", "Conservar,CONSERVAR" })
	void impactoBorradoConCadaParametroValidoLlegaAlServiceSoloEnSuCategoria(String texto, ModoBorrado esperado)
			throws Exception {
		mvc.perform(get("/api/proyectos/1/impacto-borrado?subproyectos=" + texto)).andExpect(status().isOk());
		mvc.perform(get("/api/proyectos/2/impacto-borrado?tareas=" + texto)).andExpect(status().isOk());
		mvc.perform(get("/api/proyectos/3/impacto-borrado?ideas=" + texto)).andExpect(status().isOk());

		verify(service).impactoBorrado(1L, new EleccionesBorradoProyecto(esperado, null, null));
		verify(service).impactoBorrado(2L, new EleccionesBorradoProyecto(null, esperado, null));
		verify(service).impactoBorrado(3L, new EleccionesBorradoProyecto(null, null, esperado));
	}

	@ParameterizedTest
	@CsvSource({ "subproyectos", "tareas", "ideas" })
	void impactoBorradoConUnValorInvalidoDevuelve400ConElParametroYNoLlamaAlService(String parametro) throws Exception {
		mvc.perform(get("/api/proyectos/1/impacto-borrado?" + parametro + "=raro"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.mensaje").value(containsString(parametro + " inválido")))
				.andExpect(jsonPath("$.mensaje").value(containsString("borrar o conservar")));

		verifyNoInteractions(service);
	}

	@Test
	void impactoBorradoDeUnIdInexistenteDevuelve404() throws Exception {
		when(service.impactoBorrado(7L, EleccionesBorradoProyecto.NINGUNA))
				.thenThrow(new ProyectoNoEncontradoException(7L));

		mvc.perform(get("/api/proyectos/7/impacto-borrado")).andExpect(status().isNotFound());
	}

	@Test
	void impactoBorradoConValorInvalidoEnUnIdInexistenteDa400Primero() throws Exception {
		mvc.perform(get("/api/proyectos/7/impacto-borrado?tareas=raro")).andExpect(status().isBadRequest());

		verifyNoInteractions(service);
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
