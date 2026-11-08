package com.agoals.evento;

import com.agoals.common.Prioridad;
import com.agoals.evento.dto.EventoRequest;
import com.agoals.evento.dto.EventoResponse;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class EventoServiceTest {

	private static final Long U = EventoService.USUARIO_ID;

	@Mock
	EventoRepository repository;

	@InjectMocks
	EventoService service;

	private static OffsetDateTime t(String iso) {
		return OffsetDateTime.parse(iso);
	}

	private static EventoRequest request(String inicio, String fin) {
		return new EventoRequest("Dentista", "detalle", t(inicio), t(fin), Prioridad.MEDIA);
	}

	private static Evento evento(long id, String inicio, String fin) {
		Evento e = new Evento();
		ReflectionTestUtils.setField(e, "id", id);
		e.setUsuarioId(U);
		e.setTitulo("e" + id);
		e.setFechaHoraInicio(t(inicio));
		e.setFechaHoraFin(t(fin));
		return e;
	}

	private Evento existe(Evento e) {
		when(repository.findByIdAndUsuarioId(e.getId(), U)).thenReturn(Optional.of(e));
		return e;
	}

	private void noExiste(long id) {
		when(repository.findByIdAndUsuarioId(id, U)).thenReturn(Optional.empty());
	}

	private Evento guardado() {
		ArgumentCaptor<Evento> captor = ArgumentCaptor.forClass(Evento.class);
		verify(repository).saveAndFlush(captor.capture());
		return captor.getValue();
	}

	private void devuelveLosDelUsuario(Evento... eventos) {
		when(repository.findByUsuarioIdOrderByFechaHoraInicioAscIdAsc(U)).thenReturn(List.of(eventos));
	}

	private static List<Long> ids(List<EventoResponse> respuesta) {
		return respuesta.stream().map(EventoResponse::id).toList();
	}

	// ---- Crear ----

	@Test
	void crearGuardaTodosLosCamposParaElUsuarioPorDefecto() {
		when(repository.saveAndFlush(any(Evento.class))).thenAnswer(i -> i.getArgument(0));

		EventoResponse r = service.crear(request("2026-11-10T15:00:00-03:00", "2026-11-10T16:00:00-03:00"));

		Evento e = guardado();
		assertThat(e.getUsuarioId()).isEqualTo(U);
		assertThat(e.getTitulo()).isEqualTo("Dentista");
		assertThat(e.getDescripcion()).isEqualTo("detalle");
		assertThat(e.getPrioridad()).isEqualTo(Prioridad.MEDIA);
		assertThat(e.getFechaHoraInicio().toInstant()).isEqualTo(t("2026-11-10T18:00:00Z").toInstant());
		assertThat(e.getFechaHoraFin().toInstant()).isEqualTo(t("2026-11-10T19:00:00Z").toInstant());
		assertThat(r.titulo()).isEqualTo("Dentista");
	}

	@Test
	void crearConDescripcionNullGuardaCadenaVacia() {
		when(repository.saveAndFlush(any(Evento.class))).thenAnswer(i -> i.getArgument(0));

		service.crear(new EventoRequest("Sin detalle", null, t("2026-11-10T15:00:00-03:00"),
				t("2026-11-10T16:00:00-03:00"), null));

		assertThat(guardado().getDescripcion()).isEmpty();
		assertThat(guardado().getPrioridad()).isNull();
	}

	@Test
	void crearConFinIgualAlInicioResponde400() {
		assertThatThrownBy(() -> service.crear(request("2026-11-10T15:00:00-03:00", "2026-11-10T15:00:00-03:00")))
				.isInstanceOf(EventoInvalidoException.class);
		verify(repository, never()).saveAndFlush(any());
	}

	@Test
	void crearConFinAnteriorAlInicioResponde400() {
		assertThatThrownBy(() -> service.crear(request("2026-11-10T15:00:00-03:00", "2026-11-10T14:00:00-03:00")))
				.isInstanceOf(EventoInvalidoException.class);
		verify(repository, never()).saveAndFlush(any());
	}

	@Test
	void laValidacionDeFinComparaInstantesYNoElDesfase() {
		// 15:00-03:00 = 18:00Z. El fin "16:00+00:00" parece posterior como texto, pero es 16:00Z: anterior.
		assertThatThrownBy(() -> service.crear(request("2026-11-10T15:00:00-03:00", "2026-11-10T16:00:00Z")))
				.isInstanceOf(EventoInvalidoException.class);
		// Y al revés: 21:00+02:00 = 19:00Z es posterior a 18:00Z aunque "21" > "15" no lo mostrara.
		when(repository.saveAndFlush(any(Evento.class))).thenAnswer(i -> i.getArgument(0));
		service.crear(request("2026-11-10T15:00:00-03:00", "2026-11-10T21:00:00+02:00"));
		verify(repository).saveAndFlush(any(Evento.class));
	}

	// ---- Obtener ----

	@Test
	void obtenerDevuelveElEvento() {
		existe(evento(1, "2026-11-10T15:00:00-03:00", "2026-11-10T16:00:00-03:00"));

		assertThat(service.obtener(1L).id()).isEqualTo(1L);
	}

	@Test
	void obtenerInexistenteLanza404() {
		noExiste(9);

		assertThatThrownBy(() -> service.obtener(9L))
				.isInstanceOf(EventoNoEncontradoException.class)
				.hasMessageContaining("9");
	}

	// ---- Actualizar (PUT = reemplazo completo) ----

	@Test
	void actualizarReemplazaTodosLosCampos() {
		Evento e = existe(evento(1, "2026-11-10T15:00:00-03:00", "2026-11-10T16:00:00-03:00"));
		when(repository.saveAndFlush(any(Evento.class))).thenAnswer(i -> i.getArgument(0));

		service.actualizar(1L, new EventoRequest("Nuevo", "desc", t("2026-12-01T09:00:00-03:00"),
				t("2026-12-01T10:00:00-03:00"), Prioridad.ALTA));

		assertThat(e.getTitulo()).isEqualTo("Nuevo");
		assertThat(e.getDescripcion()).isEqualTo("desc");
		assertThat(e.getPrioridad()).isEqualTo(Prioridad.ALTA);
		assertThat(e.getFechaHoraInicio().toInstant()).isEqualTo(t("2026-12-01T12:00:00Z").toInstant());
		assertThat(e.getFechaHoraFin().toInstant()).isEqualTo(t("2026-12-01T13:00:00Z").toInstant());
	}

	@Test
	void actualizarConCamposOpcionalesOmitidosLosDejaVaciosONull() {
		Evento e = evento(1, "2026-11-10T15:00:00-03:00", "2026-11-10T16:00:00-03:00");
		e.setDescripcion("tenia detalle");
		e.setPrioridad(Prioridad.ALTA);
		existe(e);
		when(repository.saveAndFlush(any(Evento.class))).thenAnswer(i -> i.getArgument(0));

		service.actualizar(1L, new EventoRequest("Solo titulo", null, t("2026-11-10T15:00:00-03:00"),
				t("2026-11-10T16:00:00-03:00"), null));

		assertThat(e.getDescripcion()).isEmpty();
		assertThat(e.getPrioridad()).isNull();
	}

	@Test
	void actualizarConFinNoPosteriorResponde400SinGuardar() {
		existe(evento(1, "2026-11-10T15:00:00-03:00", "2026-11-10T16:00:00-03:00"));

		assertThatThrownBy(() -> service.actualizar(1L, request("2026-11-10T15:00:00-03:00", "2026-11-10T15:00:00-03:00")))
				.isInstanceOf(EventoInvalidoException.class);
		verify(repository, never()).saveAndFlush(any());
	}

	@Test
	void actualizarInexistenteLanza404() {
		noExiste(9);

		assertThatThrownBy(() -> service.actualizar(9L, request("2026-11-10T15:00:00-03:00", "2026-11-10T16:00:00-03:00")))
				.isInstanceOf(EventoNoEncontradoException.class);
	}

	// ---- Eliminar ----

	@Test
	void eliminarBorraElEventoSinComprobarDependencias() {
		Evento e = existe(evento(1, "2026-11-10T15:00:00-03:00", "2026-11-10T16:00:00-03:00"));

		service.eliminar(1L);

		verify(repository).delete(e);
	}

	@Test
	void eliminarInexistenteLanza404() {
		noExiste(9);

		assertThatThrownBy(() -> service.eliminar(9L)).isInstanceOf(EventoNoEncontradoException.class);
		verify(repository, never()).delete(any());
	}

	// ---- Listar: solapamiento (inicio < hasta Y fin > desde) ----

	private static final String DESDE = "2026-11-10T00:00:00-03:00";
	private static final String HASTA = "2026-11-11T00:00:00-03:00";

	@Test
	void unEventoDentroDelRangoEntra() {
		devuelveLosDelUsuario(evento(1, "2026-11-10T10:00:00-03:00", "2026-11-10T11:00:00-03:00"));

		assertThat(ids(service.listar(t(DESDE), t(HASTA)))).containsExactly(1L);
	}

	@Test
	void unEventoQueTerminaExactamenteEnDesdeNoEntra() {
		devuelveLosDelUsuario(evento(1, "2026-11-09T22:00:00-03:00", "2026-11-10T00:00:00-03:00"));

		assertThat(service.listar(t(DESDE), t(HASTA))).isEmpty();
	}

	@Test
	void unEventoQueEmpiezaExactamenteEnHastaNoEntra() {
		devuelveLosDelUsuario(evento(1, "2026-11-11T00:00:00-03:00", "2026-11-11T01:00:00-03:00"));

		assertThat(service.listar(t(DESDE), t(HASTA))).isEmpty();
	}

	@Test
	void unEventoQueTerminaUnInstanteDespuesDeDesdeEntra() {
		devuelveLosDelUsuario(evento(1, "2026-11-09T22:00:00-03:00", "2026-11-10T00:00:00.001-03:00"));

		assertThat(ids(service.listar(t(DESDE), t(HASTA)))).containsExactly(1L);
	}

	@Test
	void unEventoQueEmpiezaUnInstanteAntesDeHastaEntra() {
		devuelveLosDelUsuario(evento(1, "2026-11-10T23:59:59.999-03:00", "2026-11-11T01:00:00-03:00"));

		assertThat(ids(service.listar(t(DESDE), t(HASTA)))).containsExactly(1L);
	}

	@Test
	void unEventoQueCruzaLaMedianocheEntraEnLosDosDias() {
		Evento noche = evento(1, "2026-11-10T23:00:00-03:00", "2026-11-11T01:00:00-03:00");
		devuelveLosDelUsuario(noche);

		assertThat(ids(service.listar(t("2026-11-10T00:00:00-03:00"), t("2026-11-11T00:00:00-03:00")))).containsExactly(1L);
		assertThat(ids(service.listar(t("2026-11-11T00:00:00-03:00"), t("2026-11-12T00:00:00-03:00")))).containsExactly(1L);
	}

	@Test
	void unEventoQueEnvuelveElRangoEntra() {
		devuelveLosDelUsuario(evento(1, "2026-11-01T00:00:00-03:00", "2026-11-30T00:00:00-03:00"));

		assertThat(ids(service.listar(t(DESDE), t(HASTA)))).containsExactly(1L);
	}

	@Test
	void eventosFueraDelRangoNoEntran() {
		devuelveLosDelUsuario(
				evento(1, "2026-11-08T10:00:00-03:00", "2026-11-08T11:00:00-03:00"),
				evento(2, "2026-11-12T10:00:00-03:00", "2026-11-12T11:00:00-03:00"));

		assertThat(service.listar(t(DESDE), t(HASTA))).isEmpty();
	}

	@Test
	void elRangoSeComparaPorInstantesNoPorElDesfase() {
		// El evento termina a las 11:00-03:00 = 14:00Z. Pedir desde 14:00Z (escrito como 17:00+03:00) lo deja afuera.
		devuelveLosDelUsuario(evento(1, "2026-11-10T10:00:00-03:00", "2026-11-10T11:00:00-03:00"));

		assertThat(service.listar(t("2026-11-10T17:00:00+03:00"), t("2026-11-10T20:00:00+03:00"))).isEmpty();
		assertThat(ids(service.listar(t("2026-11-10T13:59:00Z"), t("2026-11-10T20:00:00Z")))).containsExactly(1L);
	}

	@Test
	void sinDesdeNoSeAcotaPorLaIzquierda() {
		devuelveLosDelUsuario(
				evento(1, "2020-01-01T10:00:00-03:00", "2020-01-01T11:00:00-03:00"),
				evento(2, "2026-11-10T10:00:00-03:00", "2026-11-10T11:00:00-03:00"),
				evento(3, "2026-11-11T00:00:00-03:00", "2026-11-11T01:00:00-03:00"));

		// Solo hasta: entran los que empiezan antes de hasta (el 3 empieza justo en hasta: no entra).
		assertThat(ids(service.listar(null, t(HASTA)))).containsExactly(1L, 2L);
	}

	@Test
	void sinHastaNoSeAcotaPorLaDerecha() {
		devuelveLosDelUsuario(
				evento(1, "2026-11-09T22:00:00-03:00", "2026-11-10T00:00:00-03:00"),
				evento(2, "2026-11-10T10:00:00-03:00", "2026-11-10T11:00:00-03:00"),
				evento(3, "2090-01-01T00:00:00-03:00", "2090-01-01T01:00:00-03:00"));

		// Solo desde: entran los que terminan después de desde (el 1 termina justo en desde: no entra).
		assertThat(ids(service.listar(t(DESDE), null))).containsExactly(2L, 3L);
	}

	@Test
	void sinNingunExtremoDevuelveTodosEnElOrdenDelRepository() {
		devuelveLosDelUsuario(
				evento(2, "2026-11-10T08:00:00-03:00", "2026-11-10T09:00:00-03:00"),
				evento(1, "2026-11-10T09:00:00-03:00", "2026-11-10T10:00:00-03:00"));

		assertThat(ids(service.listar(null, null))).containsExactly(2L, 1L);
	}

	@Test
	void hastaIgualADesdeResponde400() {
		assertThatThrownBy(() -> service.listar(t(DESDE), t(DESDE)))
				.isInstanceOf(EventoInvalidoException.class);
		verify(repository, never()).findByUsuarioIdOrderByFechaHoraInicioAscIdAsc(any());
	}

	@Test
	void hastaAnteriorADesdeResponde400() {
		assertThatThrownBy(() -> service.listar(t(HASTA), t(DESDE)))
				.isInstanceOf(EventoInvalidoException.class);
	}

	@Test
	void hastaIgualADesdeEnOtroDesfaseTambienResponde400() {
		// Mismo instante escrito con desfases distintos.
		assertThatThrownBy(() -> service.listar(t("2026-11-10T00:00:00-03:00"), t("2026-11-10T03:00:00Z")))
				.isInstanceOf(EventoInvalidoException.class);
	}
}
