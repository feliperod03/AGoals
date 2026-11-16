package com.agoals.serie;

import com.agoals.common.Prioridad;
import com.agoals.evento.EventoNoEncontradoException;
import com.agoals.evento.EventoService;
import com.agoals.evento.dto.EventoDeSerie;
import com.agoals.evento.dto.EventoResponse;
import com.agoals.recordatorio.RecordatorioService;
import com.agoals.recordatorio.dto.RecordatorioDeEvento;
import com.agoals.serie.dto.RecordatorioSerieRequest;
import com.agoals.serie.dto.SerieEventoCreadaResponse;
import com.agoals.serie.dto.SerieEventoEdicionRequest;
import com.agoals.serie.dto.SerieEventoEdicionResponse;
import com.agoals.serie.dto.SerieEventoRequest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

// 2098-03-12 es miércoles. Zona de la serie: Buenos Aires (-03:00).
@ExtendWith(MockitoExtension.class)
class SerieEventoServiceTest {

	private static final Long U = SerieEventoService.USUARIO_ID;
	private static final String ZONA = "America/Argentina/Buenos_Aires";
	private static final long SERIE_ID = 7L;

	@Mock
	SerieEventoRepository repository;

	@Mock
	EventoService eventoService;

	@Mock
	RecordatorioService recordatorioService;

	@InjectMocks
	SerieEventoService service;

	private static OffsetDateTime t(String iso) {
		return OffsetDateTime.parse(iso);
	}

	/** Miércoles semanal, 3 repeticiones, 18:00-20:00, ahora = martes 10/03 a las 10:00, recordatorio por defecto. */
	private static SerieEventoRequest semanalMiercoles() {
		return new SerieEventoRequest("ZZ-rec Clase", "Aula 3", Prioridad.MEDIA, LocalTime.of(18, 0), LocalTime.of(20, 0),
				ZONA, t("2098-03-11T10:00:00-03:00"), Frecuencia.SEMANAL, Set.of(DiaSemana.MIERCOLES), null, null, null, 3,
				new RecordatorioSerieRequest(null));
	}

	private static SerieEventoRequest con(SerieEventoRequest b, Frecuencia f, Set<DiaSemana> dias, Integer intervalo,
			Integer diaMes, LocalDate hasta, Integer repeticiones) {
		return new SerieEventoRequest(b.titulo(), b.descripcion(), b.prioridad(), b.horaInicio(), b.horaFin(),
				b.zonaHoraria(), b.ahora(), f, dias, intervalo, diaMes, hasta, repeticiones, b.recordatorio());
	}

	private void guardaLaSerie() {
		when(repository.saveAndFlush(any(SerieEvento.class))).thenAnswer(i -> {
			SerieEvento s = i.getArgument(0);
			ReflectionTestUtils.setField(s, "id", SERIE_ID);
			return s;
		});
	}

	private void creaLosEventos() {
		when(eventoService.crearDeSerie(eq(SERIE_ID), anyList())).thenAnswer(i -> {
			List<EventoDeSerie> datos = i.getArgument(1);
			List<EventoResponse> r = new ArrayList<>();
			for (int n = 0; n < datos.size(); n++) {
				EventoDeSerie e = datos.get(n);
				r.add(new EventoResponse(100L + n, e.titulo(), e.descripcion(), e.fechaHoraInicio(), e.fechaHoraFin(),
						e.prioridad(), SERIE_ID));
			}
			return r;
		});
	}

	private void nadaSeEscribio() {
		verifyNoInteractions(repository, eventoService, recordatorioService);
	}

	@SuppressWarnings("unchecked")
	private List<RecordatorioDeEvento> pedidosDeRecordatorio() {
		ArgumentCaptor<List<RecordatorioDeEvento>> captor = ArgumentCaptor.forClass(List.class);
		verify(recordatorioService).sincronizarDeEventos(captor.capture());
		return captor.getValue();
	}

	// ---- Crear: validación (400, sin escribir nada) ----

	@Test
	void sinFinResponde400SinEscribir() {
		assertThatThrownBy(() -> service.crear(con(semanalMiercoles(), Frecuencia.SEMANAL, Set.of(DiaSemana.MIERCOLES), null,
				null, null, null)))
				.isInstanceOf(SerieEventoInvalidaException.class).hasMessageContaining("un final");
		nadaSeEscribio();
	}

	@Test
	void conLosDosFinalesResponde400() {
		assertThatThrownBy(() -> service.crear(con(semanalMiercoles(), Frecuencia.SEMANAL, Set.of(DiaSemana.MIERCOLES), null,
				null, LocalDate.parse("2098-06-01"), 3)))
				.isInstanceOf(SerieEventoInvalidaException.class).hasMessageContaining("no ambos");
		nadaSeEscribio();
	}

	@Test
	void repeticionesFueraDeRangoResponde400() {
		for (int malo : new int[] { 0, 261 }) {
			assertThatThrownBy(() -> service.crear(con(semanalMiercoles(), Frecuencia.SEMANAL,
					Set.of(DiaSemana.MIERCOLES), null, null, null, malo)))
					.isInstanceOf(SerieEventoInvalidaException.class).hasMessageContaining("260");
		}
		nadaSeEscribio();
	}

	@Test
	void semanalSinDiasOConDiaMesResponde400() {
		assertThatThrownBy(() -> service.crear(con(semanalMiercoles(), Frecuencia.SEMANAL, Set.of(), null, null, null, 3)))
				.isInstanceOf(SerieEventoInvalidaException.class);
		assertThatThrownBy(() -> service.crear(con(semanalMiercoles(), Frecuencia.SEMANAL, Set.of(DiaSemana.LUNES), null,
				20, null, 3))).isInstanceOf(SerieEventoInvalidaException.class);
		nadaSeEscribio();
	}

	@Test
	void intervaloDistintoDe1o2Responde400() {
		assertThatThrownBy(() -> service.crear(con(semanalMiercoles(), Frecuencia.SEMANAL, Set.of(DiaSemana.LUNES), 3, null,
				null, 3))).isInstanceOf(SerieEventoInvalidaException.class).hasMessageContaining("1 o 2");
		nadaSeEscribio();
	}

	@Test
	void mensualSinDiaMesOFueraDeRangoOConDiasResponde400() {
		assertThatThrownBy(() -> service.crear(con(semanalMiercoles(), Frecuencia.MENSUAL, null, null, null, null, 3)))
				.isInstanceOf(SerieEventoInvalidaException.class);
		assertThatThrownBy(() -> service.crear(con(semanalMiercoles(), Frecuencia.MENSUAL, null, null, 32, null, 3)))
				.isInstanceOf(SerieEventoInvalidaException.class);
		assertThatThrownBy(() -> service.crear(con(semanalMiercoles(), Frecuencia.MENSUAL, Set.of(DiaSemana.LUNES), null, 20,
				null, 3))).isInstanceOf(SerieEventoInvalidaException.class);
		nadaSeEscribio();
	}

	@Test
	void zonaInvalidaResponde400() {
		SerieEventoRequest b = semanalMiercoles();
		SerieEventoRequest r = new SerieEventoRequest(b.titulo(), b.descripcion(), b.prioridad(), b.horaInicio(),
				b.horaFin(), "Marte/Olympus", b.ahora(), b.frecuencia(), b.diasSemana(), null, null, null, 3, null);
		assertThatThrownBy(() -> service.crear(r)).isInstanceOf(SerieEventoInvalidaException.class)
				.hasMessageContaining("Zona horaria inválida");
		nadaSeEscribio();
	}

	@Test
	void todoElDiaQuedaFueraDeLasSeriesYResponde400() {
		SerieEventoRequest b = semanalMiercoles();
		SerieEventoRequest r = new SerieEventoRequest(b.titulo(), b.descripcion(), b.prioridad(), LocalTime.of(9, 0),
				LocalTime.of(9, 0), ZONA, b.ahora(), b.frecuencia(), b.diasSemana(), null, null, null, 3, null);
		assertThatThrownBy(() -> service.crear(r)).isInstanceOf(SerieEventoInvalidaException.class)
				.hasMessageContaining("todo el día");
		nadaSeEscribio();
	}

	@Test
	void hastaAnteriorALaPrimeraOcurrenciaResponde400SinEscribir() {
		// ahora = martes 10/03; el miércoles 11/03 es la primera, pero 'hasta' es el 10/03.
		assertThatThrownBy(() -> service.crear(con(semanalMiercoles(), Frecuencia.SEMANAL, Set.of(DiaSemana.MIERCOLES), null,
				null, LocalDate.parse("2098-03-11"), null)))
				.isInstanceOf(SerieEventoInvalidaException.class).hasMessageContaining("ninguna ocurrencia");
		nadaSeEscribio();
	}

	@Test
	void minutosAntesFueraDeRangoResponde400() {
		SerieEventoRequest b = semanalMiercoles();
		SerieEventoRequest r = new SerieEventoRequest(b.titulo(), b.descripcion(), b.prioridad(), b.horaInicio(),
				b.horaFin(), ZONA, b.ahora(), b.frecuencia(), b.diasSemana(), null, null, null, 3,
				new RecordatorioSerieRequest(10081));
		assertThatThrownBy(() -> service.crear(r)).isInstanceOf(SerieEventoInvalidaException.class);
		nadaSeEscribio();
	}

	// ---- Crear: camino feliz ----

	@Test
	void creaLaSerieLosEventosYLosRecordatorios() {
		guardaLaSerie();
		creaLosEventos();

		SerieEventoCreadaResponse r = service.crear(semanalMiercoles());

		ArgumentCaptor<SerieEvento> serie = ArgumentCaptor.forClass(SerieEvento.class);
		verify(repository).saveAndFlush(serie.capture());
		SerieEvento s = serie.getValue();
		assertThat(s.getUsuarioId()).isEqualTo(U);
		assertThat(s.getFrecuencia()).isEqualTo(Frecuencia.SEMANAL);
		assertThat(s.getDiasSemana()).containsExactly(DiaSemana.MIERCOLES);
		assertThat(s.getIntervaloSemanas()).isEqualTo(1);
		assertThat(s.getDiaMes()).isNull();
		assertThat(s.getFechaInicio()).isEqualTo(LocalDate.parse("2098-03-12"));
		assertThat(s.getRepeticiones()).isEqualTo(3);
		assertThat(s.getHasta()).isNull();
		assertThat(s.getZonaHoraria()).isEqualTo(ZONA);

		@SuppressWarnings("unchecked")
		ArgumentCaptor<List<EventoDeSerie>> datos = ArgumentCaptor.forClass(List.class);
		verify(eventoService).crearDeSerie(eq(SERIE_ID), datos.capture());
		assertThat(datos.getValue()).extracting(e -> e.fechaHoraInicio().toInstant()).containsExactly(
				t("2098-03-12T18:00:00-03:00").toInstant(), t("2098-03-19T18:00:00-03:00").toInstant(),
				t("2098-03-26T18:00:00-03:00").toInstant());
		assertThat(datos.getValue()).allSatisfy(e -> {
			assertThat(e.titulo()).isEqualTo("ZZ-rec Clase");
			assertThat(e.descripcion()).isEqualTo("Aula 3");
			assertThat(e.prioridad()).isEqualTo(Prioridad.MEDIA);
			assertThat(e.fechaHoraFin().toInstant().minusSeconds(7200)).isEqualTo(e.fechaHoraInicio().toInstant());
		});

		// Por defecto: 60 min antes de cada una, y los ids de los eventos creados.
		assertThat(pedidosDeRecordatorio()).containsExactly(
				new RecordatorioDeEvento(100L, t("2098-03-12T17:00:00-03:00")),
				new RecordatorioDeEvento(101L, t("2098-03-19T17:00:00-03:00")),
				new RecordatorioDeEvento(102L, t("2098-03-26T17:00:00-03:00")));
		assertThat(r.eventos()).hasSize(3);
		assertThat(r.recordatoriosCreados()).isEqualTo(3);
		assertThat(r.recordatoriosOmitidos()).isZero();
		assertThat(r.serie().id()).isEqualTo(SERIE_ID);
	}

	@Test
	void laOcurrenciaDeHoyCuyoRecordatorioYaPasoSeCreaSinRecordatorio() {
		guardaLaSerie();
		creaLosEventos();
		// ahora = miércoles 11/03 a las 17:30: hoy es día de la regla, la clase es a las 18:00 y su aviso (17:00) ya pasó.
		SerieEventoRequest b = semanalMiercoles();
		SerieEventoRequest r = new SerieEventoRequest(b.titulo(), b.descripcion(), b.prioridad(), b.horaInicio(),
				b.horaFin(), ZONA, t("2098-03-12T17:30:00-03:00"), b.frecuencia(), b.diasSemana(), null, null, null, 3,
				b.recordatorio());

		SerieEventoCreadaResponse resp = service.crear(r);

		assertThat(resp.eventos()).hasSize(3);
		assertThat(resp.eventos().get(0).fechaHoraInicio().toInstant()).isEqualTo(t("2098-03-12T18:00:00-03:00").toInstant());
		assertThat(pedidosDeRecordatorio()).extracting(RecordatorioDeEvento::eventoId).containsExactly(101L, 102L);
		assertThat(resp.recordatoriosCreados()).isEqualTo(2);
		assertThat(resp.recordatoriosOmitidos()).isEqualTo(1);
	}

	@Test
	void sinRecordatorioPedidoNoSeTocaElModuloRecordatorio() {
		guardaLaSerie();
		creaLosEventos();
		SerieEventoRequest b = semanalMiercoles();
		SerieEventoRequest r = new SerieEventoRequest(b.titulo(), b.descripcion(), b.prioridad(), b.horaInicio(),
				b.horaFin(), ZONA, b.ahora(), b.frecuencia(), b.diasSemana(), null, null, null, 3, null);

		SerieEventoCreadaResponse resp = service.crear(r);

		verifyNoInteractions(recordatorioService);
		assertThat(resp.recordatoriosCreados()).isZero();
		assertThat(resp.recordatoriosOmitidos()).isZero();
	}

	@Test
	void unaSerieMensualGuardaElDiaDelMesYNoLosDias() {
		guardaLaSerie();
		creaLosEventos();

		service.crear(con(semanalMiercoles(), Frecuencia.MENSUAL, null, null, 31, null, 2));

		ArgumentCaptor<SerieEvento> serie = ArgumentCaptor.forClass(SerieEvento.class);
		verify(repository).saveAndFlush(serie.capture());
		assertThat(serie.getValue().getDiaMes()).isEqualTo(31);
		assertThat(serie.getValue().getDiasSemana()).isNull();
		assertThat(serie.getValue().getIntervaloSemanas()).isNull();
		assertThat(serie.getValue().getFechaInicio()).isEqualTo(LocalDate.parse("2098-03-31"));
	}

	// ---- Editar toda la serie ----

	private static EventoResponse ev(long id, String inicio, Long serieId) {
		OffsetDateTime i = t(inicio);
		return new EventoResponse(id, "viejo", "", i, i.plusHours(2), null, serieId);
	}

	private SerieEvento serie(String fechaInicio) {
		SerieEvento s = new SerieEvento();
		ReflectionTestUtils.setField(s, "id", SERIE_ID);
		s.setUsuarioId(U);
		s.setFrecuencia(Frecuencia.SEMANAL);
		s.setDiasSemana(EnumSet.of(DiaSemana.MIERCOLES));
		s.setIntervaloSemanas(1);
		s.setFechaInicio(LocalDate.parse(fechaInicio));
		s.setRepeticiones(5);
		s.setZonaHoraria(ZONA);
		return s;
	}

	private void laSerieExiste(SerieEvento s) {
		when(repository.findByIdAndUsuarioId(SERIE_ID, U)).thenReturn(Optional.of(s));
	}

	private static SerieEventoEdicionRequest edicion(RecordatorioSerieRequest rec, OffsetDateTime ahora) {
		return new SerieEventoEdicionRequest("ZZ-rec Nuevo", null, Prioridad.ALTA, LocalTime.of(19, 0), LocalTime.of(21, 0),
				ahora, rec);
	}

	@Test
	void editarUnEventoInexistenteSePropaga404() {
		when(eventoService.obtener(9L)).thenThrow(new EventoNoEncontradoException(9L));

		assertThatThrownBy(() -> service.editarDesde(9L, edicion(null, t("2098-03-11T10:00:00-03:00"))))
				.isInstanceOf(EventoNoEncontradoException.class);
	}

	@Test
	void editarUnEventoSueltoResponde409() {
		when(eventoService.obtener(5L)).thenReturn(ev(5, "2098-03-12T18:00:00-03:00", null));

		assertThatThrownBy(() -> service.editarDesde(5L, edicion(null, t("2098-03-11T10:00:00-03:00"))))
				.isInstanceOf(SerieEventoConflictoException.class).hasMessageContaining("no pertenece a una serie");
		verify(eventoService, never()).actualizarDeSerie(anyLong(), any());
	}

	@Test
	void editarConHorasIgualesResponde400SinActualizar() {
		when(eventoService.obtener(5L)).thenReturn(ev(5, "2098-03-19T18:00:00-03:00", SERIE_ID));
		laSerieExiste(serie("2098-03-12"));
		SerieEventoEdicionRequest r = new SerieEventoEdicionRequest("x", null, null, LocalTime.of(9, 0), LocalTime.of(9, 0),
				t("2098-03-11T10:00:00-03:00"), null);

		assertThatThrownBy(() -> service.editarDesde(5L, r)).isInstanceOf(SerieEventoInvalidaException.class)
				.hasMessageContaining("todo el día");
		verify(eventoService, never()).actualizarDeSerie(anyLong(), any());
	}

	private void devuelveSiguientes(EventoResponse... siguientes) {
		when(eventoService.ocurrenciasDeSerieDesde(eq(SERIE_ID), any())).thenReturn(List.of(siguientes));
		when(eventoService.actualizarDeSerie(anyLong(), any())).thenAnswer(i -> {
			EventoDeSerie d = i.getArgument(1);
			return new EventoResponse(i.getArgument(0), d.titulo(), d.descripcion(), d.fechaHoraInicio(), d.fechaHoraFin(),
					d.prioridad(), SERIE_ID);
		});
	}

	@Test
	void editarTomaLaElegidaYLasSiguientesYConservaLaFechaDeCadaUna() {
		EventoResponse elegida = ev(2, "2098-03-19T18:00:00-03:00", SERIE_ID);
		// La tercera se movió "solo este" al jueves 26/03 y a otra hora: conserva el jueves, pero pasa a las 19:00.
		EventoResponse movida = ev(3, "2098-03-27T10:00:00-03:00", SERIE_ID);
		when(eventoService.obtener(2L)).thenReturn(elegida);
		laSerieExiste(serie("2098-03-12"));
		devuelveSiguientes(elegida, movida);

		SerieEventoEdicionResponse r = service.editarDesde(2L, edicion(new RecordatorioSerieRequest(30),
				t("2098-03-11T10:00:00-03:00")));

		verify(eventoService).ocurrenciasDeSerieDesde(SERIE_ID, elegida.fechaHoraInicio());
		ArgumentCaptor<EventoDeSerie> datos = ArgumentCaptor.forClass(EventoDeSerie.class);
		verify(eventoService).actualizarDeSerie(eq(2L), datos.capture());
		assertThat(datos.getValue().titulo()).isEqualTo("ZZ-rec Nuevo");
		assertThat(datos.getValue().descripcion()).isEmpty();
		assertThat(datos.getValue().prioridad()).isEqualTo(Prioridad.ALTA);
		assertThat(datos.getValue().fechaHoraInicio().toInstant()).isEqualTo(t("2098-03-19T19:00:00-03:00").toInstant());
		assertThat(datos.getValue().fechaHoraFin().toInstant()).isEqualTo(t("2098-03-19T21:00:00-03:00").toInstant());
		ArgumentCaptor<EventoDeSerie> datos3 = ArgumentCaptor.forClass(EventoDeSerie.class);
		verify(eventoService).actualizarDeSerie(eq(3L), datos3.capture());
		assertThat(datos3.getValue().fechaHoraInicio().toInstant()).isEqualTo(t("2098-03-27T19:00:00-03:00").toInstant());

		assertThat(pedidosDeRecordatorio()).containsExactly(
				new RecordatorioDeEvento(2L, t("2098-03-19T18:30:00-03:00")),
				new RecordatorioDeEvento(3L, t("2098-03-27T18:30:00-03:00")));
		assertThat(r.eventos()).hasSize(2);
		assertThat(r.recordatoriosOmitidos()).isZero();
	}

	@Test
	void editarSinRecordatorioPedidoBorraLosPendientes() {
		EventoResponse elegida = ev(2, "2098-03-19T18:00:00-03:00", SERIE_ID);
		when(eventoService.obtener(2L)).thenReturn(elegida);
		laSerieExiste(serie("2098-03-12"));
		devuelveSiguientes(elegida, ev(3, "2098-03-26T18:00:00-03:00", SERIE_ID));

		SerieEventoEdicionResponse r = service.editarDesde(2L, edicion(null, t("2098-03-11T10:00:00-03:00")));

		assertThat(pedidosDeRecordatorio()).containsExactly(new RecordatorioDeEvento(2L, null),
				new RecordatorioDeEvento(3L, null));
		assertThat(r.recordatoriosOmitidos()).isZero();
	}

	@Test
	void siElInstanteNuevoYaPasoElPendienteNoSeTocaYCuentaComoOmitido() {
		EventoResponse elegida = ev(2, "2098-03-19T18:00:00-03:00", SERIE_ID);
		when(eventoService.obtener(2L)).thenReturn(elegida);
		laSerieExiste(serie("2098-03-12"));
		devuelveSiguientes(elegida, ev(3, "2098-03-26T18:00:00-03:00", SERIE_ID));
		// ahora = 18/03 18:30; la clase nueva es a las 19:00 y su aviso (60 min antes = 18:00) ya pasó. La del 25/03 no.
		SerieEventoEdicionResponse r = service.editarDesde(2L, edicion(new RecordatorioSerieRequest(null),
				t("2098-03-19T18:30:00-03:00")));

		// La omitida NO entra en la lista: ni se borra ni se mueve su pendiente existente.
		assertThat(pedidosDeRecordatorio()).containsExactly(new RecordatorioDeEvento(3L, t("2098-03-26T18:00:00-03:00")));
		assertThat(r.recordatoriosOmitidos()).isEqualTo(1);
		assertThat(r.eventos()).hasSize(2);
	}

	// ---- Borrar toda la serie ----

	@Test
	void borrarUnEventoSueltoResponde409() {
		when(eventoService.obtener(5L)).thenReturn(ev(5, "2098-03-12T18:00:00-03:00", null));

		assertThatThrownBy(() -> service.eliminarDesde(5L)).isInstanceOf(SerieEventoConflictoException.class);
		verify(eventoService, never()).eliminarDeSerieDesde(anyLong(), any());
	}

	@Test
	void borrarUnEventoInexistenteSePropaga404() {
		when(eventoService.obtener(9L)).thenThrow(new EventoNoEncontradoException(9L));

		assertThatThrownBy(() -> service.eliminarDesde(9L)).isInstanceOf(EventoNoEncontradoException.class);
	}

	@Test
	void siNoQuedaNingunaOcurrenciaSeBorraLaSerie() {
		EventoResponse primera = ev(1, "2098-03-12T18:00:00-03:00", SERIE_ID);
		SerieEvento s = serie("2098-03-12");
		when(eventoService.obtener(1L)).thenReturn(primera);
		laSerieExiste(s);
		when(eventoService.existenDeSerie(SERIE_ID)).thenReturn(false);

		service.eliminarDesde(1L);

		verify(eventoService).eliminarDeSerieDesde(SERIE_ID, primera.fechaHoraInicio());
		verify(repository).delete(s);
	}

	@Test
	void siQuedanAnterioresLaSerieSeRecortaAlDiaAnterior() {
		EventoResponse cuarta = ev(4, "2098-04-02T18:00:00-03:00", SERIE_ID);
		SerieEvento s = serie("2098-03-12");
		when(eventoService.obtener(4L)).thenReturn(cuarta);
		laSerieExiste(s);
		when(eventoService.existenDeSerie(SERIE_ID)).thenReturn(true);

		service.eliminarDesde(4L);

		assertThat(s.getHasta()).isEqualTo(LocalDate.parse("2098-04-01"));
		assertThat(s.getRepeticiones()).isNull();
		verify(repository).saveAndFlush(s);
		verify(repository, never()).delete(any(SerieEvento.class));
	}

	@Test
	void elRecorteNuncaQuedaAntesDeLaFechaDeInicio() {
		// Una ocurrencia se movió con "solo este" a antes de fecha_inicio: el día anterior (03/03) sería < fecha_inicio (11/03)
		// y violaría CHECK (hasta >= fecha_inicio). Se usa max(fecha_inicio, día anterior).
		EventoResponse movida = ev(4, "2098-03-05T18:00:00-03:00", SERIE_ID);
		SerieEvento s = serie("2098-03-12");
		when(eventoService.obtener(4L)).thenReturn(movida);
		laSerieExiste(s);
		when(eventoService.existenDeSerie(SERIE_ID)).thenReturn(true);

		service.eliminarDesde(4L);

		assertThat(s.getHasta()).isEqualTo(LocalDate.parse("2098-03-12"));
		assertThat(s.getHasta()).isAfterOrEqualTo(s.getFechaInicio());
		assertThat(s.getRepeticiones()).isNull();
	}

	@Test
	void obtenerUnaSerieInexistenteLanza404() {
		when(repository.findByIdAndUsuarioId(9L, U)).thenReturn(Optional.empty());

		assertThatThrownBy(() -> service.obtener(9L)).isInstanceOf(SerieEventoNoEncontradaException.class)
				.hasMessage("Serie no encontrada: 9");
	}
}
