package com.agoals.serie;

import com.agoals.evento.Evento;
import com.agoals.evento.EventoRepository;
import com.agoals.recordatorio.Recordatorio;
import com.agoals.recordatorio.RecordatorioRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.EnumSet;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

// PostgreSQL real de Docker con Flyway (V3): mapeo, converter de días, CHECKs, índice, SET NULL y cascada.
// Cada test hace rollback. Datos en 2090+ y se comprueba por ids propios, nunca por tamaño de lista.
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class SerieEventoRepositoryTest {

	@Autowired
	SerieEventoRepository series;

	@Autowired
	EventoRepository eventos;

	@Autowired
	RecordatorioRepository recordatorios;

	@Autowired
	EntityManager em;

	private static OffsetDateTime t(String iso) {
		return OffsetDateTime.parse(iso);
	}

	private SerieEvento semanal() {
		SerieEvento s = new SerieEvento();
		s.setUsuarioId(1L);
		s.setFrecuencia(Frecuencia.SEMANAL);
		s.setDiasSemana(EnumSet.of(DiaSemana.VIERNES, DiaSemana.LUNES, DiaSemana.MIERCOLES));
		s.setIntervaloSemanas(2);
		s.setFechaInicio(LocalDate.parse("2090-03-05"));
		s.setRepeticiones(10);
		s.setZonaHoraria("America/Argentina/Buenos_Aires");
		return s;
	}

	private SerieEvento mensual() {
		SerieEvento s = new SerieEvento();
		s.setUsuarioId(1L);
		s.setFrecuencia(Frecuencia.MENSUAL);
		s.setDiaMes(31);
		s.setFechaInicio(LocalDate.parse("2090-03-31"));
		s.setHasta(LocalDate.parse("2091-03-31"));
		s.setZonaHoraria("America/Argentina/Buenos_Aires");
		return s;
	}

	private Evento evento(Long serieId, String titulo, String inicio) {
		Evento e = new Evento();
		e.setUsuarioId(1L);
		e.setSerieId(serieId);
		e.setTitulo(titulo);
		e.setFechaHoraInicio(t(inicio));
		e.setFechaHoraFin(t(inicio).plusHours(1));
		return eventos.saveAndFlush(e);
	}

	// ---- Mapeo ----

	@Test
	void guardaYLeeUnaSerieSemanalConLosDiasEnElOrdenDeLaSemana() {
		SerieEvento s = series.saveAndFlush(semanal());
		em.clear();

		SerieEvento leida = series.findByIdAndUsuarioId(s.getId(), 1L).orElseThrow();
		assertThat(leida.getFrecuencia()).isEqualTo(Frecuencia.SEMANAL);
		assertThat(leida.getDiasSemana()).containsExactly(DiaSemana.LUNES, DiaSemana.MIERCOLES, DiaSemana.VIERNES);
		assertThat(leida.getIntervaloSemanas()).isEqualTo(2);
		assertThat(leida.getDiaMes()).isNull();
		assertThat(leida.getFechaInicio()).isEqualTo(LocalDate.parse("2090-03-05"));
		assertThat(leida.getRepeticiones()).isEqualTo(10);
		assertThat(leida.getHasta()).isNull();
		assertThat(leida.getZonaHoraria()).isEqualTo("America/Argentina/Buenos_Aires");
		// En la base queda como texto legible.
		Object crudo = em.createNativeQuery("SELECT dias_semana FROM serie_evento WHERE id = :id")
				.setParameter("id", s.getId()).getSingleResult();
		assertThat(crudo).isEqualTo("LUNES,MIERCOLES,VIERNES");
	}

	@Test
	void guardaYLeeUnaSerieMensual() {
		SerieEvento s = series.saveAndFlush(mensual());
		em.clear();

		SerieEvento leida = series.findByIdAndUsuarioId(s.getId(), 1L).orElseThrow();
		assertThat(leida.getFrecuencia()).isEqualTo(Frecuencia.MENSUAL);
		assertThat(leida.getDiaMes()).isEqualTo(31);
		assertThat(leida.getDiasSemana()).isNull();
		assertThat(leida.getIntervaloSemanas()).isNull();
		assertThat(leida.getHasta()).isEqualTo(LocalDate.parse("2091-03-31"));
		assertThat(leida.getRepeticiones()).isNull();
	}

	@Test
	void noEncuentraSeriesDeOtroUsuario() {
		SerieEvento s = series.saveAndFlush(semanal());

		assertThat(series.findByIdAndUsuarioId(s.getId(), 2L)).isEmpty();
	}

	// ---- CHECKs de la base (red de seguridad de las validaciones del service) ----

	@Test
	void laBaseRechazaUnaSerieSemanalSinDias() {
		SerieEvento s = semanal();
		s.setDiasSemana(null);
		assertThatThrownBy(() -> series.saveAndFlush(s)).isInstanceOf(Exception.class);
	}

	@Test
	void laBaseRechazaUnIntervaloDistintoDe1o2() {
		SerieEvento s = semanal();
		s.setIntervaloSemanas(3);
		assertThatThrownBy(() -> series.saveAndFlush(s)).isInstanceOf(Exception.class);
	}

	@Test
	void laBaseRechazaLosDosFinalesALaVez() {
		SerieEvento s = semanal();
		s.setHasta(LocalDate.parse("2090-12-31"));
		assertThatThrownBy(() -> series.saveAndFlush(s)).isInstanceOf(Exception.class);
	}

	@Test
	void laBaseRechazaUnaSerieSinFinal() {
		SerieEvento s = semanal();
		s.setRepeticiones(null);
		assertThatThrownBy(() -> series.saveAndFlush(s)).isInstanceOf(Exception.class);
	}

	@Test
	void laBaseRechazaMasDe260Repeticiones() {
		SerieEvento s = semanal();
		s.setRepeticiones(261);
		assertThatThrownBy(() -> series.saveAndFlush(s)).isInstanceOf(Exception.class);
	}

	@Test
	void laBaseRechazaUnDiaDelMesFueraDeRango() {
		SerieEvento s = mensual();
		s.setDiaMes(32);
		assertThatThrownBy(() -> series.saveAndFlush(s)).isInstanceOf(Exception.class);
	}

	@Test
	void laBaseRechazaUnaSerieMensualConDias() {
		SerieEvento s = mensual();
		s.setDiasSemana(EnumSet.of(DiaSemana.LUNES));
		assertThatThrownBy(() -> series.saveAndFlush(s)).isInstanceOf(Exception.class);
	}

	@Test
	void laBaseRechazaUnHastaAnteriorALaFechaDeInicio() {
		SerieEvento s = mensual();
		s.setHasta(LocalDate.parse("2090-03-30"));
		assertThatThrownBy(() -> series.saveAndFlush(s)).isInstanceOf(Exception.class);
	}

	// ---- Eventos de una serie ----

	@Test
	void unEventoGuardaYLeeSuSerieIdYUnoSueltoLoTieneNull() {
		SerieEvento s = series.saveAndFlush(semanal());
		Evento deSerie = evento(s.getId(), "ZZ-rec a", "2090-03-05T10:00:00-03:00");
		Evento suelto = evento(null, "ZZ-rec suelto", "2090-03-05T12:00:00-03:00");
		em.clear();

		assertThat(eventos.findByIdAndUsuarioId(deSerie.getId(), 1L).orElseThrow().getSerieId()).isEqualTo(s.getId());
		assertThat(eventos.findByIdAndUsuarioId(suelto.getId(), 1L).orElseThrow().getSerieId()).isNull();
	}

	@Test
	void laConsultaDesdeTomaLaElegidaYLasSiguientesDeEsaSerieOrdenadasPorInstante() {
		SerieEvento s = series.saveAndFlush(semanal());
		SerieEvento otra = series.saveAndFlush(mensual());
		Evento primera = evento(s.getId(), "ZZ-rec 1", "2090-03-05T18:00:00-03:00");
		Evento tercera = evento(s.getId(), "ZZ-rec 3", "2090-03-19T18:00:00-03:00");
		Evento segunda = evento(s.getId(), "ZZ-rec 2", "2090-03-12T18:00:00-03:00");
		Evento deOtraSerie = evento(otra.getId(), "ZZ-rec otra", "2090-03-20T18:00:00-03:00");
		Evento suelto = evento(null, "ZZ-rec suelto", "2090-03-21T18:00:00-03:00");

		// El mismo instante escrito en otro desfase (21:00Z = 18:00-03:00): el borde cuenta por instante.
		List<Evento> desdeLaSegunda = eventos
				.findBySerieIdAndUsuarioIdAndFechaHoraInicioGreaterThanEqualOrderByFechaHoraInicioAscIdAsc(
						s.getId(), 1L, t("2090-03-12T21:00:00Z"));

		assertThat(desdeLaSegunda).extracting(Evento::getId).containsExactly(segunda.getId(), tercera.getId());
		assertThat(desdeLaSegunda).extracting(Evento::getId)
				.doesNotContain(primera.getId(), deOtraSerie.getId(), suelto.getId());
	}

	@Test
	void existsDetectaSiLaSerieTieneOcurrenciasYNoMiraAOtroUsuario() {
		SerieEvento conEventos = series.saveAndFlush(semanal());
		SerieEvento vacia = series.saveAndFlush(mensual());
		evento(conEventos.getId(), "ZZ-rec 1", "2090-03-05T18:00:00-03:00");

		assertThat(eventos.existsBySerieIdAndUsuarioId(conEventos.getId(), 1L)).isTrue();
		assertThat(eventos.existsBySerieIdAndUsuarioId(conEventos.getId(), 2L)).isFalse();
		assertThat(eventos.existsBySerieIdAndUsuarioId(vacia.getId(), 1L)).isFalse();
	}

	@Test
	void alBorrarLaSerieSusEventosQuedanSueltosYNoSePierden() {
		SerieEvento s = series.saveAndFlush(semanal());
		Evento e = evento(s.getId(), "ZZ-rec 1", "2090-03-05T18:00:00-03:00");

		series.delete(s);
		series.flush();
		em.clear();

		Evento leido = eventos.findByIdAndUsuarioId(e.getId(), 1L).orElseThrow();
		assertThat(leido.getSerieId()).isNull();
	}

	@Test
	void unaClaveDeSerieInexistenteEsRechazada() {
		assertThatThrownBy(() -> evento(999_999_999L, "ZZ-rec huérfano", "2090-03-05T18:00:00-03:00"))
				.isInstanceOf(Exception.class);
	}

	@Test
	void alBorrarLasOcurrenciasSusRecordatoriosDesaparecenEnCascada() {
		SerieEvento s = series.saveAndFlush(semanal());
		Evento e1 = evento(s.getId(), "ZZ-rec 1", "2090-03-05T18:00:00-03:00");
		Evento e2 = evento(s.getId(), "ZZ-rec 2", "2090-03-12T18:00:00-03:00");
		Recordatorio r1 = recordatorioDe(e1);
		Recordatorio r2 = recordatorioDe(e2);

		eventos.deleteAll(List.of(e1, e2));
		eventos.flush();
		em.clear();

		assertThat(recordatorios.findById(r1.getId())).isEmpty();
		assertThat(recordatorios.findById(r2.getId())).isEmpty();
	}

	private Recordatorio recordatorioDe(Evento e) {
		Recordatorio r = new Recordatorio();
		r.setUsuarioId(1L);
		r.setEventoId(e.getId());
		r.setFechaHora(e.getFechaHoraInicio().minusHours(1));
		return recordatorios.saveAndFlush(r);
	}
}
