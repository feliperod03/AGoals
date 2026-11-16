package com.agoals.serie;

import com.agoals.common.Prioridad;
import com.agoals.evento.Evento;
import com.agoals.evento.EventoNoEncontradoException;
import com.agoals.evento.EventoRepository;
import com.agoals.evento.EventoService;
import com.agoals.evento.dto.EventoRequest;
import com.agoals.evento.dto.EventoResponse;
import com.agoals.recordatorio.Recordatorio;
import com.agoals.recordatorio.RecordatorioRepository;
import com.agoals.recordatorio.RecordatorioService;
import com.agoals.serie.dto.RecordatorioSerieRequest;
import com.agoals.serie.dto.SerieEventoCreadaResponse;
import com.agoals.serie.dto.SerieEventoEdicionRequest;
import com.agoals.serie.dto.SerieEventoRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.doThrow;

// Contra el PostgreSQL real, sin rollback automático: prueba la transacción de verdad. Datos "ZZ-rec" en 2098,
// borrados al terminar. Se verifica por ids propios, nunca por tamaño de lista.
@SpringBootTest
class SerieEventoIntegracionTest {

	private static final String ZONA = "America/Argentina/Buenos_Aires";
	// 2098-03-12 es miércoles; "ahora" es el martes anterior.
	private static final OffsetDateTime AHORA = OffsetDateTime.parse("2098-03-11T10:00:00-03:00");

	@Autowired
	SerieEventoService service;

	@Autowired
	EventoService eventoService;

	@MockitoSpyBean
	RecordatorioService recordatorioService;

	@Autowired
	EventoRepository eventos;

	@Autowired
	RecordatorioRepository recordatorios;

	@Autowired
	SerieEventoRepository series;

	private final Set<Long> serieIds = new HashSet<>();

	@AfterEach
	void limpiar() {
		List<Evento> propios = eventos.findByUsuarioIdOrderByFechaHoraInicioAscIdAsc(1L).stream()
				.filter(e -> e.getTitulo().startsWith("ZZ-rec")).toList();
		propios.forEach(e -> {
			if (e.getSerieId() != null) {
				serieIds.add(e.getSerieId());
			}
		});
		eventos.deleteAll(propios);
		series.deleteAllById(serieIds);
	}

	private SerieEventoCreadaResponse crearSemanal(String titulo, Integer repeticiones, RecordatorioSerieRequest rec) {
		SerieEventoCreadaResponse r = service.crear(new SerieEventoRequest(titulo, "", Prioridad.MEDIA, LocalTime.of(18, 0),
				LocalTime.of(20, 0), ZONA, AHORA, Frecuencia.SEMANAL, Set.of(DiaSemana.MIERCOLES), null, null, null,
				repeticiones, rec));
		serieIds.add(r.serie().id());
		return r;
	}

	private Map<Long, Recordatorio> recordatoriosDe(List<EventoResponse> evs) {
		return recordatorios.findByEventoIdInAndUsuarioId(evs.stream().map(EventoResponse::id).toList(), 1L).stream()
				.collect(Collectors.toMap(Recordatorio::getEventoId, Function.identity()));
	}

	private static OffsetDateTime t(String iso) {
		return OffsetDateTime.parse(iso);
	}

	@Test
	void siFallaUnRecordatorioNoQuedaNadaDeLaSerie() {
		long seriesAntes = series.count();
		doThrow(new IllegalStateException("falla simulada")).when(recordatorioService).sincronizarDeEventos(anyList());

		assertThatThrownBy(() -> crearSemanal("ZZ-rec atomico", 3, new RecordatorioSerieRequest(60)))
				.isInstanceOf(IllegalStateException.class);

		assertThat(series.count()).isEqualTo(seriesAntes);
		assertThat(eventos.findByUsuarioIdOrderByFechaHoraInicioAscIdAsc(1L))
				.noneMatch(e -> e.getTitulo().equals("ZZ-rec atomico"));
	}

	@Test
	void recorridoCompletoCrearEditarSoloEsteEditarSerieYBorrar() {
		// ---- Crear: 4 miércoles con recordatorio 60 min antes ----
		SerieEventoCreadaResponse creada = crearSemanal("ZZ-rec clase", 4, new RecordatorioSerieRequest(null));
		List<EventoResponse> evs = creada.eventos();
		assertThat(evs).hasSize(4);
		assertThat(evs).allSatisfy(e -> assertThat(e.serieId()).isEqualTo(creada.serie().id()));
		assertThat(evs.get(0).fechaHoraInicio().toInstant()).isEqualTo(t("2098-03-12T18:00:00-03:00").toInstant());
		assertThat(evs.get(3).fechaHoraInicio().toInstant()).isEqualTo(t("2098-04-02T18:00:00-03:00").toInstant());
		assertThat(creada.recordatoriosCreados()).isEqualTo(4);
		Map<Long, Recordatorio> recs = recordatoriosDe(evs);
		assertThat(recs).hasSize(4);
		assertThat(recs.get(evs.get(1).id()).getFechaHora().toInstant())
				.isEqualTo(t("2098-03-19T17:00:00-03:00").toInstant());

		// ---- El segundo recordatorio se envía; el tercer evento se mueve "solo este" al jueves 27 a las 10:00 ----
		recordatorioService.marcarEnviado(recs.get(evs.get(1).id()).getId());
		EventoResponse movido = eventoService.actualizar(evs.get(2).id(), new EventoRequest("ZZ-rec clase", "",
				t("2098-03-27T10:00:00-03:00"), t("2098-03-27T11:00:00-03:00"), Prioridad.MEDIA));
		assertThat(movido.serieId()).isEqualTo(creada.serie().id());

		// ---- Editar toda la serie desde el segundo: 19:00-21:00, aviso 30 min antes ----
		var edicion = service.editarDesde(evs.get(1).id(), new SerieEventoEdicionRequest("ZZ-rec clase nueva", "nueva",
				Prioridad.ALTA, LocalTime.of(19, 0), LocalTime.of(21, 0), AHORA, new RecordatorioSerieRequest(30)));
		assertThat(edicion.eventos()).extracting(EventoResponse::id)
				.containsExactly(evs.get(1).id(), evs.get(2).id(), evs.get(3).id());
		assertThat(edicion.recordatoriosOmitidos()).isZero();

		EventoResponse primero = eventoService.obtener(evs.get(0).id());
		assertThat(primero.titulo()).isEqualTo("ZZ-rec clase");
		assertThat(primero.fechaHoraInicio().toInstant()).isEqualTo(t("2098-03-12T18:00:00-03:00").toInstant());
		EventoResponse tercero = eventoService.obtener(evs.get(2).id());
		assertThat(tercero.titulo()).isEqualTo("ZZ-rec clase nueva");
		assertThat(tercero.prioridad()).isEqualTo(Prioridad.ALTA);
		// Conserva el jueves 27 (la fecha de la que se movió), con la hora nueva.
		assertThat(tercero.fechaHoraInicio().toInstant()).isEqualTo(t("2098-03-27T19:00:00-03:00").toInstant());
		assertThat(tercero.serieId()).isEqualTo(creada.serie().id());

		recs = recordatoriosDe(evs);
		// El primero no se tocó; el enviado (segundo) tampoco; el tercero y el cuarto se movieron a 30 min antes.
		assertThat(recs.get(evs.get(0).id()).getFechaHora().toInstant()).isEqualTo(t("2098-03-12T17:00:00-03:00").toInstant());
		assertThat(recs.get(evs.get(1).id()).isEnviado()).isTrue();
		assertThat(recs.get(evs.get(1).id()).getFechaHora().toInstant()).isEqualTo(t("2098-03-19T17:00:00-03:00").toInstant());
		assertThat(recs.get(evs.get(2).id()).getFechaHora().toInstant()).isEqualTo(t("2098-03-27T18:30:00-03:00").toInstant());
		assertThat(recs.get(evs.get(2).id()).isEnviado()).isFalse();
		assertThat(recs.get(evs.get(3).id()).getFechaHora().toInstant()).isEqualTo(t("2098-04-02T18:30:00-03:00").toInstant());

		// ---- Quitar el recordatorio de toda la serie desde el tercero: se borran los pendientes, no el enviado ----
		service.editarDesde(evs.get(2).id(), new SerieEventoEdicionRequest("ZZ-rec clase nueva", "nueva", Prioridad.ALTA,
				LocalTime.of(19, 0), LocalTime.of(21, 0), AHORA, null));
		recs = recordatoriosDe(evs);
		assertThat(recs).containsOnlyKeys(evs.get(0).id(), evs.get(1).id());

		// ---- Borrar desde el tercero (jueves 27): quedan el primero y el segundo; la serie se recorta al día anterior (26) ----
		service.eliminarDesde(evs.get(2).id());
		assertThat(eventos.findAllById(evs.stream().map(EventoResponse::id).toList())).extracting(Evento::getId)
				.containsExactlyInAnyOrder(evs.get(0).id(), evs.get(1).id());
		var serie = service.obtener(creada.serie().id());
		assertThat(serie.hasta()).isEqualTo(LocalDate.parse("2098-03-26"));
		assertThat(serie.repeticiones()).isNull();

		// ---- Borrar desde el primero: no queda nada y la serie desaparece ----
		service.eliminarDesde(evs.get(0).id());
		assertThat(eventos.findAllById(evs.stream().map(EventoResponse::id).toList())).isEmpty();
		assertThat(recordatoriosDe(evs)).isEmpty();
		assertThatThrownBy(() -> service.obtener(creada.serie().id())).isInstanceOf(SerieEventoNoEncontradaException.class);
		assertThatThrownBy(() -> eventoService.obtener(evs.get(0).id())).isInstanceOf(EventoNoEncontradoException.class);
	}

	@Test
	void siElInstanteNuevoYaPasoElPendienteNoSeTocaEnLaBaseReal() {
		SerieEventoCreadaResponse creada = crearSemanal("ZZ-rec pasado", 2, new RecordatorioSerieRequest(60));
		List<EventoResponse> evs = new ArrayList<>(creada.eventos());
		Recordatorio antes = recordatoriosDe(evs).get(evs.get(0).id());

		// "ahora" ya pasó el aviso nuevo (30 min antes de las 18:00 del 12/03 = 17:30): ese pendiente queda como estaba.
		var edicion = service.editarDesde(evs.get(0).id(), new SerieEventoEdicionRequest("ZZ-rec pasado", "", null,
				LocalTime.of(18, 0), LocalTime.of(20, 0), t("2098-03-12T17:45:00-03:00"), new RecordatorioSerieRequest(30)));

		assertThat(edicion.recordatoriosOmitidos()).isEqualTo(1);
		Map<Long, Recordatorio> despues = recordatoriosDe(evs);
		assertThat(despues.get(evs.get(0).id()).getFechaHora().toInstant()).isEqualTo(antes.getFechaHora().toInstant());
		assertThat(despues.get(evs.get(1).id()).getFechaHora().toInstant())
				.isEqualTo(t("2098-03-19T17:30:00-03:00").toInstant());
	}
}
