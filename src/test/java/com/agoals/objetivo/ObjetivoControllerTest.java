package com.agoals.objetivo;

import com.agoals.common.ApiExceptionHandler;
import com.agoals.common.ConteoBorrado;
import com.agoals.common.Estado;
import com.agoals.common.ModoBorrado;
import com.agoals.common.Prioridad;
import com.agoals.objetivo.dto.ConteoProyectosBorrado;
import com.agoals.objetivo.dto.ImpactoBorradoObjetivoResponse;
import com.agoals.objetivo.dto.ObjetivoRequest;
import com.agoals.objetivo.dto.ObjetivoResponse;
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
	void deleteSinParametrosLlamaConNingunaEleccionYDevuelve204() throws Exception {
		mvc.perform(delete("/api/objetivos/1")).andExpect(status().isNoContent());

		verify(service).eliminar(1L, EleccionesBorradoObjetivo.NINGUNA);
	}

	@Test
	void deleteConParametrosVaciosSeTrataComoAusentes() throws Exception {
		mvc.perform(delete("/api/objetivos/1?subobjetivos=&proyectos=&tareas=&ideas=")).andExpect(status().isNoContent());

		verify(service).eliminar(1L, EleccionesBorradoObjetivo.NINGUNA);
	}

	@ParameterizedTest
	@CsvSource({ "borrar,BORRAR", "BORRAR,BORRAR", "conservar,CONSERVAR", "Conservar,CONSERVAR" })
	void deleteConCadaParametroValidoLlegaAlServiceConElEnumSoloEnSuCategoria(String texto, ModoBorrado esperado)
			throws Exception {
		mvc.perform(delete("/api/objetivos/1?subobjetivos=" + texto)).andExpect(status().isNoContent());
		mvc.perform(delete("/api/objetivos/2?proyectos=" + texto)).andExpect(status().isNoContent());
		mvc.perform(delete("/api/objetivos/3?tareas=" + texto)).andExpect(status().isNoContent());
		mvc.perform(delete("/api/objetivos/4?ideas=" + texto)).andExpect(status().isNoContent());

		verify(service).eliminar(1L, new EleccionesBorradoObjetivo(esperado, null, null, null));
		verify(service).eliminar(2L, new EleccionesBorradoObjetivo(null, esperado, null, null));
		verify(service).eliminar(3L, new EleccionesBorradoObjetivo(null, null, esperado, null));
		verify(service).eliminar(4L, new EleccionesBorradoObjetivo(null, null, null, esperado));
	}

	@Test
	void deleteConVariosParametrosLosPasaTodosJuntos() throws Exception {
		mvc.perform(delete("/api/objetivos/1?subobjetivos=conservar&proyectos=borrar&tareas=conservar&ideas=borrar"))
				.andExpect(status().isNoContent());

		verify(service).eliminar(1L, new EleccionesBorradoObjetivo(ModoBorrado.CONSERVAR, ModoBorrado.BORRAR,
				ModoBorrado.CONSERVAR, ModoBorrado.BORRAR));
	}

	@ParameterizedTest
	@CsvSource({ "subobjetivos", "proyectos", "tareas", "ideas" })
	void deleteConUnValorInvalidoDevuelve400ConElParametroYNoLlamaAlService(String parametro) throws Exception {
		mvc.perform(delete("/api/objetivos/1?" + parametro + "=raro"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.mensaje").value(containsString(parametro + " inválido")))
				.andExpect(jsonPath("$.mensaje").value(containsString("borrar o conservar")));

		verifyNoInteractions(service);
	}

	@Test
	void deleteInexistenteDevuelve404() throws Exception {
		doThrow(new ObjetivoNoEncontradoException(7L)).when(service).eliminar(7L, EleccionesBorradoObjetivo.NINGUNA);

		mvc.perform(delete("/api/objetivos/7")).andExpect(status().isNotFound());
	}

	@Test
	void deleteConProyectosSinEleccionDevuelve409ConElNombre() throws Exception {
		doThrow(new ObjetivoConDependenciasException("El objetivo «Salud» tiene proyectos: indica si quieres borrarlos o conservarlos"))
				.when(service).eliminar(1L, EleccionesBorradoObjetivo.NINGUNA);

		mvc.perform(delete("/api/objetivos/1"))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.mensaje").value(containsString("«Salud» tiene proyectos")));
	}

	@Test
	void deleteConIdeasSinEleccionDevuelve409ConElNombre() throws Exception {
		doThrow(new ObjetivoConDependenciasException("El objetivo «Salud» tiene ideas: indica si quieres borrarlas o conservarlas"))
				.when(service).eliminar(1L, EleccionesBorradoObjetivo.NINGUNA);

		mvc.perform(delete("/api/objetivos/1"))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.mensaje").value(containsString("«Salud» tiene ideas")));
	}

	// ---- Vista previa del impacto del borrado (5f) ----

	private static ImpactoBorradoObjetivoResponse vacio() {
		return new ImpactoBorradoObjetivoResponse(new ConteoBorrado(0, 0), new ConteoProyectosBorrado(0, 0, 0),
				new ConteoBorrado(0, 0), new ConteoBorrado(0, 0));
	}

	@Test
	void impactoBorradoDevuelve200ConLaFormaDelContrato() throws Exception {
		when(service.impactoBorrado(1L, new EleccionesBorradoObjetivo(ModoBorrado.BORRAR, ModoBorrado.BORRAR,
				ModoBorrado.BORRAR, null)))
				.thenReturn(new ImpactoBorradoObjetivoResponse(new ConteoBorrado(1, 1),
						new ConteoProyectosBorrado(1, 2, 1), new ConteoBorrado(2, 3), new ConteoBorrado(1, 0)));

		mvc.perform(get("/api/objetivos/1/impacto-borrado?subobjetivos=borrar&proyectos=borrar&tareas=borrar"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.subobjetivos.total").value(1))
				.andExpect(jsonPath("$.subobjetivos.borrados").value(1))
				.andExpect(jsonPath("$.proyectos.total").value(1))
				.andExpect(jsonPath("$.proyectos.borrados").value(2))
				.andExpect(jsonPath("$.proyectos.rescatados").value(1))
				.andExpect(jsonPath("$.tareas.total").value(2))
				.andExpect(jsonPath("$.tareas.borrados").value(3))
				.andExpect(jsonPath("$.ideas.total").value(1))
				.andExpect(jsonPath("$.ideas.borrados").value(0));
	}

	@Test
	void impactoBorradoSinParametrosLlegaAlServiceSinElecciones() throws Exception {
		when(service.impactoBorrado(1L, EleccionesBorradoObjetivo.NINGUNA)).thenReturn(vacio());

		mvc.perform(get("/api/objetivos/1/impacto-borrado")).andExpect(status().isOk());

		verify(service).impactoBorrado(1L, EleccionesBorradoObjetivo.NINGUNA);
	}

	@Test
	void impactoBorradoConParametrosVaciosEquivaleAAusentes() throws Exception {
		when(service.impactoBorrado(1L, EleccionesBorradoObjetivo.NINGUNA)).thenReturn(vacio());

		mvc.perform(get("/api/objetivos/1/impacto-borrado?subobjetivos=&proyectos=&tareas=&ideas="))
				.andExpect(status().isOk());

		verify(service).impactoBorrado(1L, EleccionesBorradoObjetivo.NINGUNA);
	}

	@ParameterizedTest
	@CsvSource({ "borrar,BORRAR", "BORRAR,BORRAR", "conservar,CONSERVAR", "Conservar,CONSERVAR" })
	void impactoBorradoConCadaParametroValidoLlegaAlServiceSoloEnSuCategoria(String texto, ModoBorrado esperado)
			throws Exception {
		mvc.perform(get("/api/objetivos/1/impacto-borrado?subobjetivos=" + texto)).andExpect(status().isOk());
		mvc.perform(get("/api/objetivos/2/impacto-borrado?proyectos=" + texto)).andExpect(status().isOk());
		mvc.perform(get("/api/objetivos/3/impacto-borrado?tareas=" + texto)).andExpect(status().isOk());
		mvc.perform(get("/api/objetivos/4/impacto-borrado?ideas=" + texto)).andExpect(status().isOk());

		verify(service).impactoBorrado(1L, new EleccionesBorradoObjetivo(esperado, null, null, null));
		verify(service).impactoBorrado(2L, new EleccionesBorradoObjetivo(null, esperado, null, null));
		verify(service).impactoBorrado(3L, new EleccionesBorradoObjetivo(null, null, esperado, null));
		verify(service).impactoBorrado(4L, new EleccionesBorradoObjetivo(null, null, null, esperado));
	}

	@ParameterizedTest
	@CsvSource({ "subobjetivos", "proyectos", "tareas", "ideas" })
	void impactoBorradoConUnValorInvalidoDevuelve400ConElParametroYNoLlamaAlService(String parametro) throws Exception {
		mvc.perform(get("/api/objetivos/1/impacto-borrado?" + parametro + "=raro"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.mensaje").value(containsString(parametro + " inválido")))
				.andExpect(jsonPath("$.mensaje").value(containsString("borrar o conservar")));

		verifyNoInteractions(service);
	}

	@Test
	void impactoBorradoDeUnIdInexistenteDevuelve404() throws Exception {
		when(service.impactoBorrado(7L, EleccionesBorradoObjetivo.NINGUNA))
				.thenThrow(new ObjetivoNoEncontradoException(7L));

		mvc.perform(get("/api/objetivos/7/impacto-borrado")).andExpect(status().isNotFound());
	}

	@Test
	void impactoBorradoConValorInvalidoEnUnIdInexistenteDa400Primero() throws Exception {
		mvc.perform(get("/api/objetivos/7/impacto-borrado?proyectos=raro")).andExpect(status().isBadRequest());

		verifyNoInteractions(service);
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
