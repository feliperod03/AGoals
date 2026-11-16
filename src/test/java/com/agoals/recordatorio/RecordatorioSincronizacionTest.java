package com.agoals.recordatorio;

import com.agoals.evento.EventoService;
import com.agoals.recordatorio.dto.RecordatorioDeEvento;
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

// sincronizarDeEventos: lo usa el módulo serie para dejar el recordatorio de cada ocurrencia como se pidió.
@ExtendWith(MockitoExtension.class)
class RecordatorioSincronizacionTest {

	private static final Long U = RecordatorioService.USUARIO_ID;

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

	private static Recordatorio deEvento(long id, long eventoId, String fechaHora, boolean enviado) {
		Recordatorio r = new Recordatorio();
		ReflectionTestUtils.setField(r, "id", id);
		r.setUsuarioId(U);
		r.setEventoId(eventoId);
		r.setFechaHora(t(fechaHora));
		r.setEnviado(enviado);
		return r;
	}

	private void existentes(Recordatorio... rs) {
		when(repository.findByEventoIdInAndUsuarioId(any(), any())).thenReturn(List.of(rs));
	}

	@Test
	void unEnviadoNuncaSeToca() {
		Recordatorio enviado = deEvento(1, 10, "2098-03-10T09:00:00-03:00", true);
		existentes(enviado);

		service.sincronizarDeEventos(List.of(new RecordatorioDeEvento(10L, t("2098-03-11T09:00:00-03:00"))));

		assertThat(enviado.getFechaHora()).isEqualTo(t("2098-03-10T09:00:00-03:00"));
		verify(repository, never()).save(any());
		verify(repository, never()).delete(any());
	}

	@Test
	void unEnviadoTampocoSeBorraSiNoSePideRecordatorio() {
		existentes(deEvento(1, 10, "2098-03-10T09:00:00-03:00", true));

		service.sincronizarDeEventos(List.of(new RecordatorioDeEvento(10L, null)));

		verify(repository, never()).delete(any());
	}

	@Test
	void unPendienteConInstanteNuevoSeMueveYSigueSinEnviar() {
		Recordatorio pendiente = deEvento(1, 10, "2098-03-10T09:00:00-03:00", false);
		existentes(pendiente);

		service.sincronizarDeEventos(List.of(new RecordatorioDeEvento(10L, t("2098-03-11T09:00:00-03:00"))));

		assertThat(pendiente.getFechaHora().toInstant()).isEqualTo(t("2098-03-11T09:00:00-03:00").toInstant());
		assertThat(pendiente.isEnviado()).isFalse();
		verify(repository).save(pendiente);
	}

	@Test
	void unPendienteSinRecordatorioPedidoSeBorra() {
		Recordatorio pendiente = deEvento(1, 10, "2098-03-10T09:00:00-03:00", false);
		existentes(pendiente);

		service.sincronizarDeEventos(List.of(new RecordatorioDeEvento(10L, null)));

		verify(repository).delete(pendiente);
	}

	@Test
	void unEventoSinRecordatorioConInstanteSeCreaConCanalAppYDescripcionVacia() {
		existentes();

		service.sincronizarDeEventos(List.of(new RecordatorioDeEvento(10L, t("2098-03-10T09:00:00-03:00"))));

		ArgumentCaptor<Recordatorio> captor = ArgumentCaptor.forClass(Recordatorio.class);
		verify(repository).save(captor.capture());
		Recordatorio nuevo = captor.getValue();
		assertThat(nuevo.getEventoId()).isEqualTo(10L);
		assertThat(nuevo.getUsuarioId()).isEqualTo(U);
		assertThat(nuevo.getCanal()).isEqualTo(Canal.APP);
		assertThat(nuevo.getDescripcion()).isEmpty();
		assertThat(nuevo.isEnviado()).isFalse();
	}

	@Test
	void unEventoSinRecordatorioYSinInstanteNoHaceNada() {
		existentes();

		service.sincronizarDeEventos(List.of(new RecordatorioDeEvento(10L, null)));

		verify(repository, never()).save(any());
		verify(repository, never()).delete(any());
	}

	@Test
	void unaListaVaciaNoConsultaNada() {
		service.sincronizarDeEventos(List.of());

		verifyNoInteractions(repository);
	}
}
