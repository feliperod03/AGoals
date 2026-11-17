package com.agoals;

import com.agoals.common.UsuarioActual;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

/**
 * Aislamiento entre usuarios (L1a), de punta a punta contra el PostgreSQL real. Crea DOS usuarios de prueba
 * (ZZ-l1a-a-… = A, dueño de los fixtures; ZZ-l1a-b-… = B, el "ajeno") y nunca crea ni lee datos del usuario 1.
 * {@link UsuarioActual} es un mock: cada test decide quién "es" el usuario actual. Al terminar se borran solo esos dos
 * usuarios por id; todas las tablas tienen usuario_id ON DELETE CASCADE (V1/V3), así que se va todo lo suyo.
 * Se verifica por ids propios, nunca por tamaño de lista (la base es la de desarrollo).
 */
@SpringBootTest
@AutoConfigureMockMvc
class AislamientoUsuariosIntegracionTest {

	private static final long INEXISTENTE = 999_999_999L;
	private static final String[] TABLAS = { "objetivo", "proyecto", "tarea", "idea", "evento", "recordatorio", "serie_evento" };

	@Autowired
	MockMvc mvc;

	@Autowired
	JdbcTemplate jdbc;

	@MockitoBean
	UsuarioActual usuarioActual;

	Long a;
	Long b;

	// Fixtures de A
	long objetivoA;
	long proyectoA;
	long tareaA;
	long subtareaA;
	long ideaA;
	long eventoA;
	long serieA;
	long eventoDeSerieA;
	long recTareaA;
	long recEventoA;

	// Lo de B
	long objetivoB;
	long proyectoB;
	long tareaB;
	long ideaB;
	long eventoB;
	long recB;

	private final Map<String, String> instantanea = new LinkedHashMap<>();

	// ---------------------------------------------------------------- preparación y limpieza

	@BeforeEach
	void preparar() throws Exception {
		String hex = UUID.randomUUID().toString().substring(0, 8);
		a = nuevoUsuario("ZZ-l1a-a-" + hex);
		b = nuevoUsuario("ZZ-l1a-b-" + hex);

		como(a);
		objetivoA = crear("/api/objetivos", "{\"nombre\":\"ZZ-l1a objetivo A\"}");
		proyectoA = crear("/api/proyectos", "{\"nombre\":\"ZZ-l1a proyecto A\",\"objetivoId\":" + objetivoA + "}");
		tareaA = crear("/api/tareas", tarea("ZZ-l1a tarea A", null));
		subtareaA = crear("/api/tareas", tarea("ZZ-l1a subtarea A", tareaA));
		mvc.perform(put("/api/proyectos/" + proyectoA + "/tareas/" + tareaA)).andReturn();
		ideaA = crear("/api/ideas", "{\"titulo\":\"ZZ-l1a idea A\",\"proyectoId\":" + proyectoA + "}");
		eventoA = crear("/api/eventos", evento("ZZ-l1a evento A"));
		MvcResult serie = mvc.perform(post("/api/series-eventos").contentType(MediaType.APPLICATION_JSON).content(
				"{\"titulo\":\"ZZ-l1a serie A\",\"horaInicio\":\"18:00\",\"horaFin\":\"20:00\","
						+ "\"zonaHoraria\":\"America/Argentina/Buenos_Aires\",\"ahora\":\"2098-03-11T10:00:00-03:00\","
						+ "\"frecuencia\":\"SEMANAL\",\"diasSemana\":[\"MIERCOLES\"],\"repeticiones\":2}")).andReturn();
		assertThat(serie.getResponse().getStatus()).isEqualTo(201);
		String cuerpoSerie = cuerpo(serie);
		serieA = id(JsonPath.read(cuerpoSerie, "$.serie.id"));
		eventoDeSerieA = id(JsonPath.read(cuerpoSerie, "$.eventos[0].id"));
		recTareaA = crear("/api/recordatorios", recordatorio(tareaA, null));
		recEventoA = crear("/api/recordatorios", recordatorio(null, eventoA));

		como(b);
		objetivoB = crear("/api/objetivos", "{\"nombre\":\"ZZ-l1a objetivo B\"}");
		proyectoB = crear("/api/proyectos", "{\"nombre\":\"ZZ-l1a proyecto B\",\"objetivoId\":" + objetivoB + "}");
		tareaB = crear("/api/tareas", tarea("ZZ-l1a tarea B", null));
		ideaB = crear("/api/ideas", "{\"titulo\":\"ZZ-l1a idea B\"}");
		eventoB = crear("/api/eventos", evento("ZZ-l1a evento B"));
		recB = crear("/api/recordatorios", recordatorio(null, eventoB));

		como(a);
		for (String url : urlsDeA()) {
			instantanea.put(url, cuerpo(mvc.perform(get(url)).andReturn()));
		}
	}

	@AfterEach
	void limpiar() {
		List<Long> propios = new ArrayList<>();
		if (a != null) {
			propios.add(a);
		}
		if (b != null) {
			propios.add(b);
		}
		for (Long id : propios) {
			jdbc.update("DELETE FROM usuario WHERE id = ?", id);
		}
		// Nada de los dos usuarios queda en ninguna tabla.
		assertThat(jdbc.queryForObject("SELECT count(*) FROM usuario WHERE nombre_usuario LIKE 'ZZ-l1a%'", Integer.class))
				.isZero();
		for (Long id : propios) {
			for (String tabla : TABLAS) {
				assertThat(jdbc.queryForObject("SELECT count(*) FROM " + tabla + " WHERE usuario_id = ?", Integer.class, id))
						.as(tabla).isZero();
			}
		}
	}

	private Long nuevoUsuario(String nombre) {
		return jdbc.queryForObject(
				"INSERT INTO usuario (nombre_usuario, email, contrasena_hash) VALUES (?, ?, 'sin-login-test') RETURNING id",
				Long.class, nombre, nombre.toLowerCase() + "@agoals.local");
	}

	// ---------------------------------------------------------------- helpers

	private void como(Long usuarioId) {
		when(usuarioActual.id()).thenReturn(usuarioId);
	}

	private static long id(Object n) {
		return ((Number) n).longValue();
	}

	private static String cuerpo(MvcResult r) throws Exception {
		return r.getResponse().getContentAsString(StandardCharsets.UTF_8);
	}

	private long crear(String url, String json) throws Exception {
		MvcResult r = mvc.perform(post(url).contentType(MediaType.APPLICATION_JSON).content(json)).andReturn();
		assertThat(r.getResponse().getStatus()).as("POST %s: %s", url, cuerpo(r)).isEqualTo(201);
		return id(JsonPath.read(cuerpo(r), "$.id"));
	}

	private static String tarea(String titulo, Long padreId) {
		return "{\"titulo\":\"" + titulo + "\",\"fecha\":\"2098-03-10\",\"padreId\":" + padreId + "}";
	}

	private static String evento(String titulo) {
		return "{\"titulo\":\"" + titulo + "\",\"fechaHoraInicio\":\"2098-03-10T10:00:00-03:00\","
				+ "\"fechaHoraFin\":\"2098-03-10T11:00:00-03:00\"}";
	}

	private static String recordatorio(Long tareaId, Long eventoId) {
		return "{\"tareaId\":" + tareaId + ",\"eventoId\":" + eventoId + ",\"fechaHora\":\"2098-03-10T08:00:00-03:00\"}";
	}

	private static MockHttpServletRequestBuilder json(MockHttpServletRequestBuilder b, String cuerpo) {
		return b.contentType(MediaType.APPLICATION_JSON).content(cuerpo);
	}

	private List<String> urlsDeA() {
		return List.of("/api/objetivos/" + objetivoA, "/api/proyectos/" + proyectoA, "/api/tareas/" + tareaA,
				"/api/tareas/" + subtareaA, "/api/ideas/" + ideaA, "/api/eventos/" + eventoA,
				"/api/eventos/" + eventoDeSerieA, "/api/series-eventos/" + serieA, "/api/recordatorios/" + recTareaA,
				"/api/recordatorios/" + recEventoA, "/api/proyectos/" + proyectoA + "/tareas");
	}

	/** Lo de A sigue exactamente como estaba: nada se editó, borró ni vinculó desde B. */
	private void assertFixturesDeAIntactos() throws Exception {
		como(a);
		for (String url : urlsDeA()) {
			assertThat(cuerpo(mvc.perform(get(url)).andReturn())).as(url).isEqualTo(instantanea.get(url));
		}
	}

	/**
	 * Como B, pide la misma operación con un id de A y con un id inexistente: el status esperado y el mensaje deben ser
	 * idénticos (salvo el número del id). "Ajeno" no se distingue de "no existe".
	 */
	private void comoInexistente(int statusEsperado, long idAjeno, Function<Long, MockHttpServletRequestBuilder> peticion)
			throws Exception {
		como(b);
		MvcResult ajeno = mvc.perform(peticion.apply(idAjeno)).andReturn();
		MvcResult inexistente = mvc.perform(peticion.apply(INEXISTENTE)).andReturn();
		assertThat(inexistente.getResponse().getStatus()).as("inexistente: " + cuerpo(inexistente)).isEqualTo(statusEsperado);
		assertThat(ajeno.getResponse().getStatus()).as("ajeno: " + cuerpo(ajeno)).isEqualTo(statusEsperado);
		String mensajeAjeno = JsonPath.read(cuerpo(ajeno), "$.mensaje");
		String mensajeInexistente = JsonPath.read(cuerpo(inexistente), "$.mensaje");
		assertThat(mensajeAjeno).isEqualTo(mensajeInexistente.replace(String.valueOf(INEXISTENTE), String.valueOf(idAjeno)));
	}

	private List<Long> ids(String url) throws Exception {
		List<Object> crudos = JsonPath.read(cuerpo(mvc.perform(get(url)).andReturn()), "$..id");
		return crudos.stream().map(AislamientoUsuariosIntegracionTest::id).toList();
	}

	// ---------------------------------------------------------------- tests

	@Test
	void losListadosDeBNoContienenNadaDeA() throws Exception {
		como(b);
		String rango = "desde=2098-01-01T00:00:00-03:00&hasta=2099-01-01T00:00:00-03:00";
		// Control positivo: con B se ve lo de B (la consulta funciona), y nunca lo de A.
		assertThat(ids("/api/tareas")).contains(tareaB).doesNotContain(tareaA, subtareaA);
		assertThat(ids("/api/tareas/agenda?fecha=2098-03-10")).contains(tareaB).doesNotContain(tareaA, subtareaA);
		assertThat(ids("/api/tareas/atrasadas?fecha=2098-03-20")).contains(tareaB).doesNotContain(tareaA, subtareaA);
		assertThat(ids("/api/tareas/recomendacion?fecha=2098-03-20&hasta=2098-04-20")).contains(tareaB)
				.doesNotContain(tareaA, subtareaA);
		assertThat(ids("/api/objetivos")).contains(objetivoB).doesNotContain(objetivoA);
		assertThat(ids("/api/proyectos")).contains(proyectoB).doesNotContain(proyectoA);
		assertThat(ids("/api/ideas")).contains(ideaB).doesNotContain(ideaA);
		assertThat(ids("/api/eventos?" + rango)).contains(eventoB).doesNotContain(eventoA, eventoDeSerieA);
		assertThat(ids("/api/recordatorios")).contains(recB).doesNotContain(recTareaA, recEventoA);
		assertThat(ids("/api/recordatorios/vencidos?ahora=2099-01-01T00:00:00-03:00")).contains(recB)
				.doesNotContain(recTareaA, recEventoA);

		// Filtros que apuntan a ids de A: lista vacía, igual que con un id inexistente.
		assertThat(ids("/api/proyectos?objetivoId=" + objetivoA)).isEmpty();
		assertThat(ids("/api/ideas?proyectoId=" + proyectoA)).isEmpty();
		assertThat(ids("/api/ideas?objetivoId=" + objetivoA)).isEmpty();
		assertThat(ids("/api/recordatorios?tareaId=" + tareaA)).isEmpty();
		assertThat(ids("/api/recordatorios?eventoId=" + eventoA)).isEmpty();
		assertThat(ids("/api/tareas/recomendacion?fecha=2098-03-20&proyectoId=" + proyectoA)).isEmpty();
		assertThat(ids("/api/tareas/recomendacion?fecha=2098-03-20&objetivoId=" + objetivoA)).isEmpty();
		assertFixturesDeAIntactos();
	}

	@Test
	void unaTareaAjenaSeComportaComoInexistente() throws Exception {
		comoInexistente(404, tareaA, i -> get("/api/tareas/" + i));
		comoInexistente(404, tareaA, i -> json(put("/api/tareas/" + i), "{\"titulo\":\"hackeada\"}"));
		comoInexistente(404, tareaA, i -> delete("/api/tareas/" + i));
		comoInexistente(404, tareaA, i -> delete("/api/tareas/" + i + "?subtareas=borrar"));
		comoInexistente(404, tareaA, i -> patch("/api/tareas/" + i + "/hecha"));
		comoInexistente(404, tareaA, i -> patch("/api/tareas/" + i + "/reabrir"));
		comoInexistente(404, tareaA, i -> json(patch("/api/tareas/" + i + "/posponer"), "{\"fecha\":\"2098-03-20\"}"));
		comoInexistente(404, tareaA,
				i -> json(patch("/api/tareas/" + i + "/agendar"), "{\"fecha\":\"2098-03-15\",\"hoy\":\"2098-03-11\"}"));
		assertFixturesDeAIntactos();
	}

	@Test
	void unProyectoAjenoSeComportaComoInexistente() throws Exception {
		comoInexistente(404, proyectoA, i -> get("/api/proyectos/" + i));
		comoInexistente(404, proyectoA, i -> json(put("/api/proyectos/" + i), "{\"nombre\":\"hackeado\"}"));
		comoInexistente(404, proyectoA, i -> delete("/api/proyectos/" + i));
		comoInexistente(404, proyectoA, i -> delete("/api/proyectos/" + i + "?tareas=borrar&ideas=borrar"));
		comoInexistente(404, proyectoA, i -> get("/api/proyectos/" + i + "/impacto-borrado"));
		comoInexistente(404, proyectoA, i -> get("/api/proyectos/" + i + "/tareas"));
		// Una tarea PROPIA de B en un proyecto ajeno: el proyecto no existe para B.
		comoInexistente(404, proyectoA, i -> put("/api/proyectos/" + i + "/tareas/" + tareaB));
		comoInexistente(404, proyectoA, i -> delete("/api/proyectos/" + i + "/tareas/" + tareaB));
		assertFixturesDeAIntactos();
	}

	@Test
	void unObjetivoAjenoSeComportaComoInexistente() throws Exception {
		comoInexistente(404, objetivoA, i -> get("/api/objetivos/" + i));
		comoInexistente(404, objetivoA, i -> json(put("/api/objetivos/" + i), "{\"nombre\":\"hackeado\"}"));
		comoInexistente(404, objetivoA, i -> delete("/api/objetivos/" + i));
		comoInexistente(404, objetivoA, i -> delete("/api/objetivos/" + i + "?proyectos=borrar&tareas=borrar&ideas=borrar"));
		comoInexistente(404, objetivoA, i -> get("/api/objetivos/" + i + "/impacto-borrado"));
		comoInexistente(404, objetivoA, i -> get("/api/objetivos/" + i + "/tareas"));
		comoInexistente(404, objetivoA, i -> put("/api/objetivos/" + i + "/tareas/" + tareaB));
		comoInexistente(404, objetivoA, i -> delete("/api/objetivos/" + i + "/tareas/" + tareaB));
		assertFixturesDeAIntactos();
	}

	@Test
	void unaTareaAjenaNoSePuedeVincularAUnProyectoNiObjetivoPropios() throws Exception {
		comoInexistente(404, tareaA, i -> put("/api/proyectos/" + proyectoB + "/tareas/" + i));
		comoInexistente(404, tareaA, i -> delete("/api/proyectos/" + proyectoB + "/tareas/" + i));
		comoInexistente(404, tareaA, i -> put("/api/objetivos/" + objetivoB + "/tareas/" + i));
		comoInexistente(404, tareaA, i -> delete("/api/objetivos/" + objetivoB + "/tareas/" + i));
		assertFixturesDeAIntactos();
	}

	@Test
	void unaIdeaAjenaSeComportaComoInexistente() throws Exception {
		comoInexistente(404, ideaA, i -> get("/api/ideas/" + i));
		comoInexistente(404, ideaA, i -> json(put("/api/ideas/" + i), "{\"titulo\":\"hackeada\"}"));
		comoInexistente(404, ideaA, i -> delete("/api/ideas/" + i));
		comoInexistente(404, ideaA, i -> json(patch("/api/ideas/" + i + "/concluir"), "{}"));
		comoInexistente(404, ideaA, i -> patch("/api/ideas/" + i + "/reabrir"));
		assertFixturesDeAIntactos();
	}

	@Test
	void unEventoYUnaSerieAjenosSeComportanComoInexistentes() throws Exception {
		String evento = evento("hackeado");
		comoInexistente(404, eventoA, i -> get("/api/eventos/" + i));
		comoInexistente(404, eventoA, i -> json(put("/api/eventos/" + i), evento));
		comoInexistente(404, eventoA, i -> delete("/api/eventos/" + i));
		comoInexistente(404, serieA, i -> get("/api/series-eventos/" + i));
		// "Toda la serie" y "esta y las siguientes" parten del evento: ajeno = no existe.
		comoInexistente(404, eventoDeSerieA, i -> json(put("/api/eventos/" + i + "/serie"),
				"{\"titulo\":\"hackeada\",\"horaInicio\":\"09:00\",\"horaFin\":\"10:00\",\"ahora\":\"2098-03-11T10:00:00-03:00\"}"));
		comoInexistente(404, eventoDeSerieA, i -> delete("/api/eventos/" + i + "/serie"));
		assertFixturesDeAIntactos();
	}

	@Test
	void unRecordatorioAjenoSeComportaComoInexistente() throws Exception {
		String cuerpo = "{\"fechaHora\":\"2098-03-10T09:00:00-03:00\",\"descripcion\":\"hackeado\"}";
		comoInexistente(404, recTareaA, i -> get("/api/recordatorios/" + i));
		comoInexistente(404, recTareaA, i -> json(put("/api/recordatorios/" + i), cuerpo));
		comoInexistente(404, recTareaA, i -> patch("/api/recordatorios/" + i + "/marcar-enviado"));
		comoInexistente(404, recEventoA, i -> delete("/api/recordatorios/" + i));
		assertFixturesDeAIntactos();
	}

	@Test
	void losIdsAjenosEnElCuerpoDan400ComoLosInexistentes() throws Exception {
		// padreId
		comoInexistente(400, tareaA, i -> json(post("/api/tareas"), tarea("ZZ-l1a hija", i)));
		comoInexistente(400, tareaA, i -> json(put("/api/tareas/" + tareaB), tarea("ZZ-l1a editada", i)));
		comoInexistente(400, proyectoA, i -> json(post("/api/proyectos"), "{\"nombre\":\"ZZ-l1a x\",\"padreId\":" + i + "}"));
		comoInexistente(400, proyectoA,
				i -> json(put("/api/proyectos/" + proyectoB), "{\"nombre\":\"ZZ-l1a x\",\"padreId\":" + i + "}"));
		comoInexistente(400, objetivoA, i -> json(post("/api/objetivos"), "{\"nombre\":\"ZZ-l1a x\",\"padreId\":" + i + "}"));
		comoInexistente(400, objetivoA,
				i -> json(put("/api/objetivos/" + objetivoB), "{\"nombre\":\"ZZ-l1a x\",\"padreId\":" + i + "}"));
		// objetivoId de proyecto, proyectoId / objetivoId de idea
		comoInexistente(400, objetivoA, i -> json(post("/api/proyectos"), "{\"nombre\":\"ZZ-l1a x\",\"objetivoId\":" + i + "}"));
		comoInexistente(400, objetivoA,
				i -> json(put("/api/proyectos/" + proyectoB), "{\"nombre\":\"ZZ-l1a x\",\"objetivoId\":" + i + "}"));
		comoInexistente(400, proyectoA, i -> json(post("/api/ideas"), "{\"titulo\":\"ZZ-l1a x\",\"proyectoId\":" + i + "}"));
		comoInexistente(400, objetivoA, i -> json(post("/api/ideas"), "{\"titulo\":\"ZZ-l1a x\",\"objetivoId\":" + i + "}"));
		comoInexistente(400, proyectoA,
				i -> json(put("/api/ideas/" + ideaB), "{\"titulo\":\"ZZ-l1a x\",\"proyectoId\":" + i + "}"));
		comoInexistente(400, objetivoA,
				i -> json(put("/api/ideas/" + ideaB), "{\"titulo\":\"ZZ-l1a x\",\"objetivoId\":" + i + "}"));
		// tareaId / eventoId de recordatorio: 400 y nunca 409, aunque la tarea/el evento de A ya tenga recordatorio.
		comoInexistente(400, tareaA, i -> json(post("/api/recordatorios"), recordatorio(i, null)));
		comoInexistente(400, eventoA, i -> json(post("/api/recordatorios"), recordatorio(null, i)));
		comoInexistente(400, tareaA, i -> json(put("/api/recordatorios/" + recB), recordatorio(i, null)));
		comoInexistente(400, eventoA, i -> json(put("/api/recordatorios/" + recB), recordatorio(null, i)));
		assertFixturesDeAIntactos();
	}

	@Test
	void loQueCreaBQuedaConSuUsuarioYAParaAEsInexistente() throws Exception {
		assertThat(jdbc.queryForObject("SELECT usuario_id FROM tarea WHERE id = ?", Long.class, tareaB)).isEqualTo(b);
		assertThat(jdbc.queryForObject("SELECT usuario_id FROM proyecto WHERE id = ?", Long.class, proyectoB)).isEqualTo(b);
		assertThat(jdbc.queryForObject("SELECT usuario_id FROM objetivo WHERE id = ?", Long.class, objetivoB)).isEqualTo(b);
		assertThat(jdbc.queryForObject("SELECT usuario_id FROM idea WHERE id = ?", Long.class, ideaB)).isEqualTo(b);
		assertThat(jdbc.queryForObject("SELECT usuario_id FROM evento WHERE id = ?", Long.class, eventoB)).isEqualTo(b);
		assertThat(jdbc.queryForObject("SELECT usuario_id FROM recordatorio WHERE id = ?", Long.class, recB)).isEqualTo(b);
		// Y los fixtures de A son de A (los creó el usuario actual en ese momento).
		assertThat(jdbc.queryForObject("SELECT usuario_id FROM tarea WHERE id = ?", Long.class, tareaA)).isEqualTo(a);
		assertThat(jdbc.queryForObject("SELECT usuario_id FROM serie_evento WHERE id = ?", Long.class, serieA)).isEqualTo(a);
		// Simétrico: lo de B es inexistente para A.
		como(a);
		assertThat(mvc.perform(get("/api/tareas/" + tareaB)).andReturn().getResponse().getStatus()).isEqualTo(404);
		assertThat(mvc.perform(get("/api/proyectos/" + proyectoB)).andReturn().getResponse().getStatus()).isEqualTo(404);
		assertThat(mvc.perform(get("/api/recordatorios/" + recB)).andReturn().getResponse().getStatus()).isEqualTo(404);
		assertThat(ids("/api/tareas")).doesNotContain(tareaB);
	}
}
