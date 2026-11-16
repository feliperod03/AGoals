package com.agoals.serie;

import com.agoals.serie.GeneradorOcurrencias.Ocurrencia;
import com.agoals.serie.GeneradorOcurrencias.Regla;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.EnumSet;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

// Unitario puro: sin Spring, sin base y sin reloj. 2026-11-18 es miércoles.
class GeneradorOcurrenciasTest {

	private static final ZoneId BA = ZoneId.of("America/Argentina/Buenos_Aires");
	private static final ZoneId NY = ZoneId.of("America/New_York");

	private static LocalDate d(String iso) {
		return LocalDate.parse(iso);
	}

	private static Regla semanal(int intervalo, Integer repeticiones, String hasta, DiaSemana... dias) {
		return new Regla(Frecuencia.SEMANAL, EnumSet.copyOf(List.of(dias)), intervalo, null,
				hasta != null ? d(hasta) : null, repeticiones);
	}

	private static Regla mensual(int dia, Integer repeticiones, String hasta) {
		return new Regla(Frecuencia.MENSUAL, null, 1, dia, hasta != null ? d(hasta) : null, repeticiones);
	}

	private static List<LocalDate> fechas(Regla regla, String hoy) {
		return GeneradorOcurrencias.fechas(regla, d(hoy));
	}

	// ---- Semanal ----

	@Test
	void siHoyEsElDiaDeLaReglaEmpiezaHoy() {
		assertThat(fechas(semanal(1, 3, null, DiaSemana.MIERCOLES), "2026-11-18"))
				.containsExactly(d("2026-11-18"), d("2026-11-25"), d("2026-12-02"));
	}

	@Test
	void siHoyNoEsElDiaEmpiezaElProximo() {
		assertThat(fechas(semanal(1, 2, null, DiaSemana.MIERCOLES), "2026-11-19"))
				.containsExactly(d("2026-11-25"), d("2026-12-02"));
	}

	@Test
	void variosDiasSalenEnOrden() {
		assertThat(fechas(semanal(1, 5, null, DiaSemana.VIERNES, DiaSemana.LUNES, DiaSemana.MIERCOLES), "2026-11-18"))
				.containsExactly(d("2026-11-18"), d("2026-11-20"), d("2026-11-23"), d("2026-11-25"), d("2026-11-27"));
	}

	@Test
	void cadaDosSemanasSeCuentaDesdeLaSemanaDeLaPrimeraOcurrencia() {
		// Hoy jueves 19/11: la primera es el lunes 23 y esa semana es el ancla (no la de hoy).
		assertThat(fechas(semanal(2, 4, null, DiaSemana.LUNES, DiaSemana.MIERCOLES), "2026-11-19"))
				.containsExactly(d("2026-11-23"), d("2026-11-25"), d("2026-12-07"), d("2026-12-09"));
	}

	@Test
	void cadaDosSemanasConLaPrimeraEnLaSemanaDeHoy() {
		// Hoy miércoles 18/11: el lunes 16 queda atrás; la semana ancla es la de hoy y la siguiente que vale es la del 30.
		assertThat(fechas(semanal(2, 3, null, DiaSemana.LUNES, DiaSemana.MIERCOLES), "2026-11-18"))
				.containsExactly(d("2026-11-18"), d("2026-11-30"), d("2026-12-02"));
	}

	@Test
	void hastaEsInclusive() {
		assertThat(fechas(semanal(1, null, "2026-12-02", DiaSemana.MIERCOLES), "2026-11-18"))
				.containsExactly(d("2026-11-18"), d("2026-11-25"), d("2026-12-02"));
	}

	@Test
	void hastaAnteriorALaPrimeraOcurrenciaDa400() {
		assertThatThrownBy(() -> fechas(semanal(1, null, "2026-11-24", DiaSemana.MIERCOLES), "2026-11-19"))
				.isInstanceOf(SerieEventoInvalidaException.class)
				.hasMessageContaining("ninguna ocurrencia");
	}

	@Test
	void hastaAnteriorAHoyDa400() {
		assertThatThrownBy(() -> fechas(semanal(1, null, "2026-11-17", DiaSemana.MIERCOLES), "2026-11-18"))
				.isInstanceOf(SerieEventoInvalidaException.class)
				.hasMessageContaining("anterior a hoy");
	}

	@Test
	void hastaIgualAHoyConHoyEnElDiaDeLaReglaDaUna() {
		assertThat(fechas(semanal(1, null, "2026-11-18", DiaSemana.MIERCOLES), "2026-11-18"))
				.containsExactly(d("2026-11-18"));
	}

	// ---- Tope ----

	@Test
	void exactamenteElTopeEsValido() {
		List<LocalDate> f = fechas(semanal(1, GeneradorOcurrencias.TOPE, null, DiaSemana.LUNES, DiaSemana.MARTES,
				DiaSemana.MIERCOLES, DiaSemana.JUEVES, DiaSemana.VIERNES), "2026-11-16");
		assertThat(f).hasSize(260);
	}

	@Test
	void unaFechaMasQueElTopeDa400() {
		// Lunes a viernes hasta 2030: sale de largo del tope.
		assertThatThrownBy(() -> fechas(semanal(1, null, "2030-12-31", DiaSemana.LUNES, DiaSemana.MARTES,
				DiaSemana.MIERCOLES, DiaSemana.JUEVES, DiaSemana.VIERNES), "2026-11-16"))
				.isInstanceOf(SerieEventoInvalidaException.class)
				.hasMessageContaining("260");
	}

	@Test
	void unHastaLejanoNoColgaElBucleYDa400() {
		assertThatThrownBy(() -> fechas(mensual(1, null, "9999-12-31"), "2026-11-16"))
				.isInstanceOf(SerieEventoInvalidaException.class);
	}

	@Test
	void exactamenteElTopeConHastaEsValido() {
		// Un lunes por semana: la 260.ª cae 259 semanas después del primero.
		LocalDate primero = d("2026-11-16");
		List<LocalDate> f = fechas(semanal(1, null, primero.plusWeeks(259).toString(), DiaSemana.LUNES), "2026-11-16");
		assertThat(f).hasSize(260);
	}

	// ---- Mensual ----

	@Test
	void mensualConHoyEnElDiaEmpiezaHoy() {
		assertThat(fechas(mensual(20, 3, null), "2026-11-20"))
				.containsExactly(d("2026-11-20"), d("2026-12-20"), d("2027-01-20"));
	}

	@Test
	void mensualConElDiaYaPasadoEmpiezaElMesSiguiente() {
		assertThat(fechas(mensual(20, 2, null), "2026-11-21"))
				.containsExactly(d("2026-12-20"), d("2027-01-20"));
	}

	@Test
	void dia31SeAjustaAlUltimoDiaDeCadaMesSinAcumular() {
		assertThat(fechas(mensual(31, 5, null), "2027-01-10"))
				.containsExactly(d("2027-01-31"), d("2027-02-28"), d("2027-03-31"), d("2027-04-30"), d("2027-05-31"));
	}

	@Test
	void dia30EnFebreroBisiestoVaAl29() {
		assertThat(fechas(mensual(30, 3, null), "2028-01-10"))
				.containsExactly(d("2028-01-30"), d("2028-02-29"), d("2028-03-30"));
	}

	@Test
	void dia29EnFebreroNoBisiestoVaAl28() {
		assertThat(fechas(mensual(29, 3, null), "2027-01-10"))
				.containsExactly(d("2027-01-29"), d("2027-02-28"), d("2027-03-29"));
	}

	@Test
	void mensualConHoyDespuesDelAjusteDeFebreroSaltaAMarzo() {
		// Hoy 2027-02-28 y día 31: febrero se ajusta al 28 y entra hoy.
		assertThat(fechas(mensual(31, 2, null), "2027-02-28"))
				.containsExactly(d("2027-02-28"), d("2027-03-31"));
	}

	@Test
	void mensualConHastaAntesDelPrimerDiaDa400() {
		assertThatThrownBy(() -> fechas(mensual(20, null, "2026-12-10"), "2026-11-21"))
				.isInstanceOf(SerieEventoInvalidaException.class)
				.hasMessageContaining("ninguna ocurrencia");
	}

	// ---- Horarios ----

	@Test
	void unEventoQueCruzaLaMedianocheTerminaAlDiaSiguiente() {
		Ocurrencia o = GeneradorOcurrencias.tramo(d("2026-11-18"), LocalTime.of(23, 0), LocalTime.of(1, 0), BA);
		assertThat(o.inicio()).isEqualTo(OffsetDateTime.parse("2026-11-18T23:00:00-03:00"));
		assertThat(o.fin()).isEqualTo(OffsetDateTime.parse("2026-11-19T01:00:00-03:00"));
	}

	@Test
	void unEventoNormalTerminaElMismoDia() {
		Ocurrencia o = GeneradorOcurrencias.tramo(d("2026-11-18"), LocalTime.of(18, 0), LocalTime.of(20, 0), BA);
		assertThat(o.fin()).isEqualTo(OffsetDateTime.parse("2026-11-18T20:00:00-03:00"));
	}

	@Test
	void conElCambioDeHorarioLaHoraLocalSeMantieneYCambiaElInstante() {
		// En Nueva York el horario de verano empieza el 14/03/2027.
		Ocurrencia antes = GeneradorOcurrencias.tramo(d("2027-03-13"), LocalTime.of(18, 0), LocalTime.of(20, 0), NY);
		Ocurrencia despues = GeneradorOcurrencias.tramo(d("2027-03-15"), LocalTime.of(18, 0), LocalTime.of(20, 0), NY);
		assertThat(antes.inicio().getOffset()).isEqualTo(ZoneOffset.ofHours(-5));
		assertThat(despues.inicio().getOffset()).isEqualTo(ZoneOffset.ofHours(-4));
		assertThat(antes.inicio().toLocalTime()).isEqualTo(LocalTime.of(18, 0));
		assertThat(despues.inicio().toLocalTime()).isEqualTo(LocalTime.of(18, 0));
		// Entre un sábado y un lunes a las 18:00 local hay 47 horas reales, no 48.
		assertThat(Duration.between(antes.inicio(), despues.inicio())).isEqualTo(Duration.ofHours(47));
	}

	@Test
	void conElFinDelHorarioDeVeranoTambienSeMantieneLaHoraLocal() {
		// Termina el 07/11/2027.
		Ocurrencia antes = GeneradorOcurrencias.tramo(d("2027-11-06"), LocalTime.of(18, 0), LocalTime.of(19, 0), NY);
		Ocurrencia despues = GeneradorOcurrencias.tramo(d("2027-11-08"), LocalTime.of(18, 0), LocalTime.of(19, 0), NY);
		assertThat(antes.inicio().getOffset()).isEqualTo(ZoneOffset.ofHours(-4));
		assertThat(despues.inicio().getOffset()).isEqualTo(ZoneOffset.ofHours(-5));
		assertThat(Duration.between(antes.inicio(), despues.inicio())).isEqualTo(Duration.ofHours(49));
	}

	@Test
	void unInicioEnElHuecoDelCambioDeHorarioSeCorreHaciaAdelante() {
		// 02:30 no existe el 14/03/2027 en Nueva York: pasa a las 03:30 (-04:00).
		Ocurrencia o = GeneradorOcurrencias.tramo(d("2027-03-14"), LocalTime.of(2, 30), LocalTime.of(2, 45), NY);
		assertThat(o.inicio()).isEqualTo(OffsetDateTime.parse("2027-03-14T03:30:00-04:00"));
		assertThat(o.fin().isAfter(o.inicio())).isTrue();
	}

	@Test
	void siElHuecoDejaElFinAntesDelInicioSeUsaLaDuracionNominal() {
		// 02:30 -> 03:15: el inicio se corre a 03:30 y el fin (03:15) quedaría antes. Duración nominal: 45 min.
		Ocurrencia o = GeneradorOcurrencias.tramo(d("2027-03-14"), LocalTime.of(2, 30), LocalTime.of(3, 15), NY);
		assertThat(o.fin().isAfter(o.inicio())).isTrue();
		assertThat(Duration.between(o.inicio(), o.fin())).isEqualTo(Duration.ofMinutes(45));
	}

	@Test
	void unInicioEnLaHoraDobleTomaElDesfaseAnterior() {
		// 01:30 ocurre dos veces el 07/11/2027: se toma la primera (-04:00).
		Ocurrencia o = GeneradorOcurrencias.tramo(d("2027-11-07"), LocalTime.of(1, 30), LocalTime.of(2, 30), NY);
		assertThat(o.inicio().getOffset()).isEqualTo(ZoneOffset.ofHours(-4));
		assertThat(o.fin().isAfter(o.inicio())).isTrue();
	}

	// ---- Hoy, horas y zona ----

	@Test
	void hoyDependeDeLaZonaDeLaSerieYNoDeLaDeLaJvm() {
		OffsetDateTime ahora = OffsetDateTime.parse("2026-11-18T23:30:00-03:00");
		assertThat(GeneradorOcurrencias.hoy(ahora, BA)).isEqualTo(d("2026-11-18"));
		assertThat(GeneradorOcurrencias.hoy(ahora, ZoneId.of("Asia/Tokyo"))).isEqualTo(d("2026-11-19"));
	}

	@Test
	void generarUsaElHoyDeLaZona() {
		// 23:30 del miércoles en Buenos Aires: hoy es miércoles y la primera ocurrencia es hoy a las 18:00 (ya pasó, pero se crea).
		List<Ocurrencia> o = GeneradorOcurrencias.generar(semanal(1, 2, null, DiaSemana.MIERCOLES), LocalTime.of(18, 0),
				LocalTime.of(20, 0), BA, OffsetDateTime.parse("2026-11-18T23:30:00-03:00"));
		assertThat(o.get(0).fecha()).isEqualTo(d("2026-11-18"));
		assertThat(o).hasSize(2);
	}

	@Test
	void todoElDiaQuedaFueraDeLasSeriesCon400() {
		assertThatThrownBy(() -> GeneradorOcurrencias.generar(semanal(1, 2, null, DiaSemana.MIERCOLES),
				LocalTime.of(9, 0), LocalTime.of(9, 0), BA, OffsetDateTime.parse("2026-11-18T08:00:00-03:00")))
				.isInstanceOf(SerieEventoInvalidaException.class)
				.hasMessageContaining("todo el día");
	}

	@Test
	void unaZonaInvalidaDa400() {
		assertThatThrownBy(() -> GeneradorOcurrencias.zona("Marte/Olympus"))
				.isInstanceOf(SerieEventoInvalidaException.class)
				.hasMessageContaining("Zona horaria inválida");
		assertThatThrownBy(() -> GeneradorOcurrencias.zona("+03:00"))
				.isInstanceOf(SerieEventoInvalidaException.class);
		assertThat(GeneradorOcurrencias.zona("America/Argentina/Buenos_Aires")).isEqualTo(BA);
	}

	// ---- Recordatorio ----

	@Test
	void elRecordatorioFuturoSeCalculaRestandoLosMinutos() {
		OffsetDateTime inicio = OffsetDateTime.parse("2026-11-18T18:00:00-03:00");
		assertThat(GeneradorOcurrencias.instanteRecordatorio(inicio, 60, OffsetDateTime.parse("2026-11-18T10:00:00-03:00")))
				.isEqualTo(OffsetDateTime.parse("2026-11-18T17:00:00-03:00"));
	}

	@Test
	void elRecordatorioQueYaPasoSeOmite() {
		OffsetDateTime inicio = OffsetDateTime.parse("2026-11-18T18:00:00-03:00");
		assertThat(GeneradorOcurrencias.instanteRecordatorio(inicio, 60, OffsetDateTime.parse("2026-11-18T17:30:00-03:00")))
				.isNull();
	}

	@Test
	void elRecordatorioJustoEnAhoraCuentaComoPasado() {
		OffsetDateTime inicio = OffsetDateTime.parse("2026-11-18T18:00:00-03:00");
		assertThat(GeneradorOcurrencias.instanteRecordatorio(inicio, 60, OffsetDateTime.parse("2026-11-18T17:00:00-03:00")))
				.isNull();
	}
}
