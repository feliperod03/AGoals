package com.agoals.recordatorio;

import com.agoals.evento.EventoInvalidoException;
import com.agoals.evento.EventoService;
import com.agoals.recordatorio.dto.RecordatorioRequest;
import com.agoals.recordatorio.dto.RecordatorioResponse;
import com.agoals.tarea.TareaInvalidaException;
import com.agoals.tarea.TareaService;
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
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RecordatorioServiceTest {

	private static final Long U = RecordatorioService.USUARIO_ID;
	private static final String FECHA = "2098-03-10T10:00:00-03:00";

	@Mock
	RecordatorioRepository repository;

	@Mock
	TareaService tareaService;

	@Mock
	EventoService eventoService;

	@InjectMocks
	RecordatorioService service;

	private static OffsetDateTime t(String iso) {
		return OffsetDateTime.parse(iso);
	}

	private static RecordatorioRequest deTarea(Long tareaId) {
		return new RecordatorioRequest(tareaId, null, t(FECHA), null, "avisar");
	}

	private static RecordatorioRequest deEvento(Long eventoId) {
		return new RecordatorioRequest(null, eventoId, t(FECHA), null, null);
	}

	private static RecordatorioRequest suelto(String descripcion) {
		return new RecordatorioRequest(null, null, t(FECHA), null, descripcion);
	}

	private static Recordatorio recordatorio(long id, String fechaHora) {
		Recordatorio r = new Recordatorio();
		ReflectionTestUtils.setField(r, "id", id);
		r.setUsuarioId(U);
		r.setFechaHora(t(fechaHora));
		r.setDescripcion("r" + id);
		return r;
	}

	private Recordatorio existe(Recordatorio r) {
		when(repository.findByIdAndUsuarioId(r.getId(), U)).thenReturn(Optional.of(r));
		return r;
	}

	private Recordatorio guardado() {
		ArgumentCaptor<Recordatorio> captor = ArgumentCaptor.forClass(Recordatorio.class);
		verify(repository).saveAndFlush(captor.capture());
		return captor.getValue();
	}

	private void guardaTalCual() {
		when(repository.saveAndFlush(any(Recordatorio.class))).thenAnswer(i -> i.getArgument(0));
	}

	private static List<Long> ids(List<RecordatorioResponse> respuesta) {
		return respuesta.stream().map(RecordatorioResponse::id).toList();
	}

	// ---- Crear ----

	@Test
	void crearDeUnaTareaGuardaConDefaults() {
		guardaTalCual();

		RecordatorioResponse r = service.crear(deTarea(5L));

		Recordatorio g = guardado();
		assertThat(g.getUsuarioId()).isEqualTo(U);
		assertThat(g.getTareaId()).isEqualTo(5L);
		assertThat(g.getEventoId()).isNull();
		assertThat(g.getCanal()).isEqualTo(Canal.APP);
		assertThat(g.isEnviado()).isFalse();
		assertThat(g.getDescripcion()).isEqualTo("avisar");
		assertThat(g.getFechaHora().toInstant()).isEqualTo(t("2098-03-10T13:00:00Z").toInstant());
		assertThat(r.canal()).isEqualTo(Canal.APP);
		verify(tareaService).validarExiste(5L);
	}

	@Test
	void crearDeUnEventoConDescripcionNullGuardaCadenaVacia() {
		guardaTalCual();

		service.crear(deEvento(8L));

		Recordatorio g = guardado();
		assertThat(g.getEventoId()).isEqualTo(8L);
		assertThat(g.getTareaId()).isNull();
		assertThat(g.getDescripcion()).isEmpty();
		verify(eventoService).validarExiste(8L);
	}

	@Test
	void crearSueltoConDescripcionEsValido() {
		guardaTalCual();

		service.crear(suelto("Llamar al banco"));

		Recordatorio g = guardado();
		assertThat(g.getTareaId()).isNull();
		assertThat(g.getEventoId()).isNull();
		assertThat(g.getDescripcion()).isEqualTo("Llamar al banco");
		verifyNoInteractions(tareaService, eventoService);
	}

	@Test
	void crearConTareaYEventoALaVezResponde400() {
		RecordatorioRequest ambos = new RecordatorioRequest(1L, 2L, t(FECHA), null, "x");

		assertThatThrownBy(() -> service.crear(ambos)).isInstanceOf(RecordatorioInvalidoException.class);
		verify(repository, never()).saveAndFlush(any());
	}

	@Test
	void crearConTareaInexistenteResponde400ConElMensajeDeTarea() {
		doThrow(new TareaInvalidaException("La tarea no existe: 99")).when(tareaService).validarExiste(99L);

		assertThatThrownBy(() -> service.crear(deTarea(99L)))
				.isInstanceOf(TareaInvalidaException.class)
				.hasMessage("La tarea no existe: 99");
		verify(repository, never()).saveAndFlush(any());
	}

	@Test
	void crearConEventoInexistenteResponde400ConElMensajeDeEvento() {
		doThrow(new EventoInvalidoException("El evento no existe: 99")).when(eventoService).validarExiste(99L);

		assertThatThrownBy(() -> service.crear(deEvento(99L)))
				.isInstanceOf(EventoInvalidoException.class)
				.hasMessage("El evento no existe: 99");
		verify(repository, never()).saveAndFlush(any());
	}

	@Test
	void crearSueltoSinDescripcionResponde400() {
		assertThatThrownBy(() -> service.crear(suelto(null))).isInstanceOf(RecordatorioInvalidoException.class);
		assertThatThrownBy(() -> service.crear(suelto(""))).isInstanceOf(RecordatorioInvalidoException.class);
		assertThatThrownBy(() -> service.crear(suelto("   "))).isInstanceOf(RecordatorioInvalidoException.class);
		verify(repository, never()).saveAndFlush(any());
	}

	@Test
	void crearConCanalCorreoResponde400() {
		RecordatorioRequest correo = new RecordatorioRequest(null, null, t(FECHA), Canal.CORREO, "x");

		assertThatThrownBy(() -> service.crear(correo))
				.isInstanceOf(RecordatorioInvalidoException.class)
				.hasMessageContaining("todavía no está disponible");
		verify(repository, never()).saveAndFlush(any());
	}

	@Test
	void crearConCanalAppExplicitoEsValido() {
		guardaTalCual();

		service.crear(new RecordatorioRequest(null, null, t(FECHA), Canal.APP, "x"));

		assertThat(guardado().getCanal()).isEqualTo(Canal.APP);
	}

	@Test
	void crearDeUnaTareaQueYaTieneRecordatorioResponde409() {
		when(repository.existsByTareaIdAndUsuarioId(5L, U)).thenReturn(true);

		assertThatThrownBy(() -> service.crear(deTarea(5L)))
				.isInstanceOf(RecordatorioConflictoException.class)
				.hasMessageContaining("5");
		verify(repository, never()).saveAndFlush(any());
	}

	@Test
	void crearDeUnEventoQueYaTieneRecordatorioResponde409() {
		when(repository.existsByEventoIdAndUsuarioId(8L, U)).thenReturn(true);

		assertThatThrownBy(() -> service.crear(deEvento(8L)))
				.isInstanceOf(RecordatorioConflictoException.class)
				.hasMessageContaining("8");
		verify(repository, never()).saveAndFlush(any());
	}

	@Test
	void losErrores400SeEvaluanAntesQueElConflicto409() {
		// Canal CORREO + tarea ya ocupada: gana el 400, ni siquiera se consulta el duplicado.
		RecordatorioRequest r = new RecordatorioRequest(5L, null, t(FECHA), Canal.CORREO, "x");

		assertThatThrownBy(() -> service.crear(r)).isInstanceOf(RecordatorioInvalidoException.class);
		verify(repository, never()).existsByTareaIdAndUsuarioId(any(), any());
	}

	// ---- Obtener ----

	@Test
	void obtenerDevuelveElRecordatorio() {
		existe(recordatorio(1, FECHA));

		assertThat(service.obtener(1L).id()).isEqualTo(1L);
	}

	@Test
	void obtenerInexistenteLanza404() {
		when(repository.findByIdAndUsuarioId(9L, U)).thenReturn(Optional.empty());

		assertThatThrownBy(() -> service.obtener(9L)).isInstanceOf(RecordatorioNoEncontradoException.class);
	}

	// ---- Listar ----

	private void delUsuario() {
		Recordatorio deTarea = recordatorio(1, "2098-03-10T10:00:00-03:00");
		deTarea.setTareaId(5L);
		Recordatorio deEvento = recordatorio(2, "2098-03-10T11:00:00-03:00");
		deEvento.setEventoId(8L);
		Recordatorio suelto = recordatorio(3, "2098-03-10T12:00:00-03:00");
		when(repository.findByUsuarioIdOrderByFechaHoraAscIdAsc(U)).thenReturn(List.of(deTarea, deEvento, suelto));
	}

	@Test
	void listarSinFiltrosDevuelveTodosEnElOrdenDelRepository() {
		delUsuario();

		assertThat(ids(service.listar(null, null))).containsExactly(1L, 2L, 3L);
	}

	@Test
	void listarPorTareaIdFiltra() {
		delUsuario();

		assertThat(ids(service.listar(5L, null))).containsExactly(1L);
		assertThat(ids(service.listar(99L, null))).isEmpty();
	}

	@Test
	void listarPorEventoIdFiltra() {
		delUsuario();

		assertThat(ids(service.listar(null, 8L))).containsExactly(2L);
	}

	@Test
	void listarConTareaIdYEventoIdALaVezDevuelveVacio() {
		delUsuario();

		assertThat(service.listar(5L, 8L)).isEmpty();
	}

	// ---- Vencidos ----

	@Test
	void vencidosPideAlRepositoryLosNoEnviadosHastaAhora() {
		OffsetDateTime ahora = t("2098-03-10T10:00:00-03:00");
		when(repository.findByUsuarioIdAndEnviadoFalseAndFechaHoraLessThanEqualOrderByFechaHoraAscIdAsc(U, ahora))
				.thenReturn(List.of(recordatorio(1, "2098-03-10T09:00:00-03:00"),
						recordatorio(2, "2098-03-10T10:00:00-03:00")));

		assertThat(ids(service.vencidos(ahora))).containsExactly(1L, 2L);
	}

	@Test
	void vencidosPasaAhoraSinTocarlo() {
		// El borde (fechaHora == ahora entra, un instante después no, enviados no entran) lo resuelve la consulta
		// derivada (<=, enviado = false) y se comprueba contra Postgres real en RecordatorioRepositoryTest.
		OffsetDateTime ahora = t("2098-03-10T13:00:00Z");
		when(repository.findByUsuarioIdAndEnviadoFalseAndFechaHoraLessThanEqualOrderByFechaHoraAscIdAsc(U, ahora))
				.thenReturn(List.of());

		assertThat(service.vencidos(ahora)).isEmpty();
		verify(repository).findByUsuarioIdAndEnviadoFalseAndFechaHoraLessThanEqualOrderByFechaHoraAscIdAsc(U, ahora);
	}

	// ---- Actualizar (PUT = reemplazo completo) ----

	@Test
	void actualizarReemplazaTodosLosCampos() {
		Recordatorio r = existe(recordatorio(1, FECHA));
		r.setDescripcion("vieja");
		guardaTalCual();

		service.actualizar(1L, new RecordatorioRequest(null, 8L, t("2098-04-01T09:00:00-03:00"), Canal.APP, "nueva"));

		assertThat(r.getEventoId()).isEqualTo(8L);
		assertThat(r.getTareaId()).isNull();
		assertThat(r.getDescripcion()).isEqualTo("nueva");
		assertThat(r.getFechaHora().toInstant()).isEqualTo(t("2098-04-01T12:00:00Z").toInstant());
	}

	@Test
	void actualizarConDescripcionOmitidaLaDejaVacia() {
		Recordatorio r = existe(recordatorio(1, FECHA));
		r.setTareaId(5L);
		r.setDescripcion("tenia texto");
		guardaTalCual();

		service.actualizar(1L, new RecordatorioRequest(5L, null, t(FECHA), null, null));

		assertThat(r.getDescripcion()).isEmpty();
	}

	@Test
	void actualizarQueCambiaLaFechaHoraReseteaEnviado() {
		Recordatorio r = existe(recordatorio(1, "2098-03-10T10:00:00-03:00"));
		r.setEnviado(true);
		guardaTalCual();

		RecordatorioResponse resp = service.actualizar(1L,
				new RecordatorioRequest(null, null, t("2098-03-10T11:00:00-03:00"), null, "x"));

		assertThat(r.isEnviado()).isFalse();
		assertThat(resp.enviado()).isFalse();
	}

	@Test
	void actualizarQueNoCambiaLaFechaHoraConservaEnviado() {
		Recordatorio r = existe(recordatorio(1, "2098-03-10T10:00:00-03:00"));
		r.setEnviado(true);
		guardaTalCual();

		RecordatorioResponse resp = service.actualizar(1L,
				new RecordatorioRequest(null, null, t("2098-03-10T10:00:00-03:00"), null, "otra descripcion"));

		assertThat(r.isEnviado()).isTrue();
		assertThat(resp.enviado()).isTrue();
	}

	@Test
	void actualizarConElMismoInstanteEscritoConOtroDesfaseConservaEnviado() {
		Recordatorio r = existe(recordatorio(1, "2098-03-10T10:00:00-03:00"));
		r.setEnviado(true);
		guardaTalCual();

		// 10:00-03:00 = 13:00Z: es el mismo instante, no cuenta como cambio.
		service.actualizar(1L, new RecordatorioRequest(null, null, t("2098-03-10T13:00:00Z"), null, "x"));

		assertThat(r.isEnviado()).isTrue();
	}

	@Test
	void actualizarSobreSiMismoSinCambiarElVinculoNoComprueba409() {
		Recordatorio r = existe(recordatorio(1, FECHA));
		r.setTareaId(5L);
		guardaTalCual();

		service.actualizar(1L, deTarea(5L));

		// El vínculo no cambió: ni siquiera se consulta si la tarea ya tiene recordatorio (sería ella misma).
		verify(repository, never()).existsByTareaIdAndUsuarioId(any(), any());
		assertThat(r.getTareaId()).isEqualTo(5L);
	}

	@Test
	void actualizarSobreSiMismoDeEventoSinCambiarElVinculoNoComprueba409() {
		Recordatorio r = existe(recordatorio(1, FECHA));
		r.setEventoId(8L);
		guardaTalCual();

		service.actualizar(1L, deEvento(8L));

		verify(repository, never()).existsByEventoIdAndUsuarioId(any(), any());
	}

	@Test
	void actualizarCambiandoAUnaTareaQueYaTieneRecordatorioResponde409() {
		Recordatorio r = existe(recordatorio(1, FECHA));
		r.setTareaId(5L);
		when(repository.existsByTareaIdAndUsuarioId(6L, U)).thenReturn(true);

		assertThatThrownBy(() -> service.actualizar(1L, deTarea(6L)))
				.isInstanceOf(RecordatorioConflictoException.class);
		verify(repository, never()).saveAndFlush(any());
		assertThat(r.getTareaId()).isEqualTo(5L);
	}

	@Test
	void actualizarCambiandoAUnEventoQueYaTieneRecordatorioResponde409() {
		Recordatorio r = existe(recordatorio(1, FECHA));
		r.setEventoId(8L);
		when(repository.existsByEventoIdAndUsuarioId(9L, U)).thenReturn(true);

		assertThatThrownBy(() -> service.actualizar(1L, deEvento(9L)))
				.isInstanceOf(RecordatorioConflictoException.class);
		verify(repository, never()).saveAndFlush(any());
	}

	@Test
	void actualizarDeSueltoAUnaTareaLibreEsValido() {
		Recordatorio r = existe(recordatorio(1, FECHA));
		when(repository.existsByTareaIdAndUsuarioId(6L, U)).thenReturn(false);
		guardaTalCual();

		service.actualizar(1L, deTarea(6L));

		assertThat(r.getTareaId()).isEqualTo(6L);
		verify(tareaService).validarExiste(6L);
	}

	@Test
	void actualizarAplicaLasMismasValidacionesQueCrear() {
		existe(recordatorio(1, FECHA));

		assertThatThrownBy(() -> service.actualizar(1L, new RecordatorioRequest(1L, 2L, t(FECHA), null, "x")))
				.isInstanceOf(RecordatorioInvalidoException.class);
		assertThatThrownBy(() -> service.actualizar(1L, suelto("")))
				.isInstanceOf(RecordatorioInvalidoException.class);
		assertThatThrownBy(() -> service.actualizar(1L, new RecordatorioRequest(null, null, t(FECHA), Canal.CORREO, "x")))
				.isInstanceOf(RecordatorioInvalidoException.class);
		verify(repository, never()).saveAndFlush(any());
	}

	@Test
	void actualizarInexistenteLanza404() {
		when(repository.findByIdAndUsuarioId(9L, U)).thenReturn(Optional.empty());

		assertThatThrownBy(() -> service.actualizar(9L, suelto("x")))
				.isInstanceOf(RecordatorioNoEncontradoException.class);
	}

	// ---- Marcar enviado ----

	@Test
	void marcarEnviadoPasaAEnviadoTrue() {
		Recordatorio r = existe(recordatorio(1, FECHA));
		guardaTalCual();

		RecordatorioResponse resp = service.marcarEnviado(1L);

		assertThat(r.isEnviado()).isTrue();
		assertThat(resp.enviado()).isTrue();
	}

	@Test
	void marcarEnviadoEsIdempotente() {
		Recordatorio r = existe(recordatorio(1, FECHA));
		r.setEnviado(true);

		RecordatorioResponse resp = service.marcarEnviado(1L);

		assertThat(resp.enviado()).isTrue();
		verify(repository, never()).saveAndFlush(any());
	}

	@Test
	void marcarEnviadoInexistenteLanza404() {
		when(repository.findByIdAndUsuarioId(9L, U)).thenReturn(Optional.empty());

		assertThatThrownBy(() -> service.marcarEnviado(9L)).isInstanceOf(RecordatorioNoEncontradoException.class);
	}

	// ---- Eliminar ----

	@Test
	void eliminarBorraElRecordatorio() {
		Recordatorio r = existe(recordatorio(1, FECHA));

		service.eliminar(1L);

		verify(repository).delete(r);
	}

	@Test
	void eliminarInexistenteLanza404() {
		when(repository.findByIdAndUsuarioId(9L, U)).thenReturn(Optional.empty());

		assertThatThrownBy(() -> service.eliminar(9L)).isInstanceOf(RecordatorioNoEncontradoException.class);
		verify(repository, never()).delete(any());
	}
}
