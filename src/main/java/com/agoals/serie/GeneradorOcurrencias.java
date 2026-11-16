package com.agoals.serie;

import java.time.DayOfWeek;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Calcula las fechas de una serie con java.time puro. Sin Spring, sin reloj y sin la zona de la JVM:
 * "hoy" sale de {@code ahora} (que manda el cliente) en la zona de la serie.
 */
public final class GeneradorOcurrencias {

	/** Tope duro de ocurrencias por serie (lunes a viernes durante un año). */
	public static final int TOPE = 260;

	/** La regla ya normalizada: SEMANAL usa dias + intervaloSemanas; MENSUAL usa diaMes. Un solo final: hasta o repeticiones. */
	public record Regla(Frecuencia frecuencia, Set<DiaSemana> dias, int intervaloSemanas, Integer diaMes,
			LocalDate hasta, Integer repeticiones) {
	}

	public record Ocurrencia(LocalDate fecha, OffsetDateTime inicio, OffsetDateTime fin) {
	}

	private GeneradorOcurrencias() {
	}

	public static ZoneId zona(String texto) {
		if (texto == null || !ZoneId.getAvailableZoneIds().contains(texto)) {
			throw new SerieEventoInvalidaException("Zona horaria inválida: '" + texto + "'");
		}
		return ZoneId.of(texto);
	}

	/** "Todo el día" (inicio == fin) queda fuera de las series. Fin < inicio significa que termina al día siguiente. */
	public static void validarHoras(LocalTime horaInicio, LocalTime horaFin) {
		if (horaInicio.equals(horaFin)) {
			throw new SerieEventoInvalidaException(
					"Las series no admiten eventos de todo el día: la hora de fin debe ser distinta de la de inicio");
		}
	}

	public static LocalDate hoy(OffsetDateTime ahora, ZoneId zona) {
		return ahora.atZoneSameInstant(zona).toLocalDate();
	}

	/** Genera las ocurrencias desde hoy (incluido) hasta el final de la regla. 400 si no hay ninguna o si pasan del tope. */
	public static List<Ocurrencia> generar(Regla regla, LocalTime horaInicio, LocalTime horaFin, ZoneId zona,
			OffsetDateTime ahora) {
		validarHoras(horaInicio, horaFin);
		return fechas(regla, hoy(ahora, zona)).stream()
				.map(d -> tramo(d, horaInicio, horaFin, zona))
				.toList();
	}

	/** Las fechas de la regla, de hoy en adelante, en orden. */
	static List<LocalDate> fechas(Regla regla, LocalDate hoy) {
		if (regla.hasta() != null && regla.hasta().isBefore(hoy)) {
			throw new SerieEventoInvalidaException("'hasta' no puede ser anterior a hoy (" + hoy + ")");
		}
		List<LocalDate> fechas = new ArrayList<>();
		if (regla.frecuencia() == Frecuencia.SEMANAL) {
			semanales(regla, hoy, fechas);
		} else {
			mensuales(regla, hoy, fechas);
		}
		if (fechas.isEmpty()) {
			throw new SerieEventoInvalidaException(
					"La serie no tiene ninguna ocurrencia entre hoy y el " + regla.hasta());
		}
		return fechas;
	}

	private static void semanales(Regla regla, LocalDate hoy, List<LocalDate> fechas) {
		Set<DayOfWeek> dias = new HashSet<>();
		regla.dias().forEach(d -> dias.add(d.aDayOfWeek()));
		LocalDate primera = hoy;
		while (!dias.contains(primera.getDayOfWeek())) {
			primera = primera.plusDays(1);
		}
		// "Cada 2 semanas" se cuenta desde la semana (lunes a domingo) de la primera ocurrencia.
		LocalDate lunes = primera.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
		while (true) {
			for (int i = 0; i < 7; i++) {
				LocalDate d = lunes.plusDays(i);
				if (d.isBefore(hoy) || !dias.contains(d.getDayOfWeek())) {
					continue;
				}
				if (!agregar(regla, d, fechas)) {
					return;
				}
			}
			lunes = lunes.plusWeeks(regla.intervaloSemanas());
		}
	}

	private static void mensuales(Regla regla, LocalDate hoy, List<LocalDate> fechas) {
		YearMonth mes = YearMonth.from(hoy);
		while (true) {
			// El ajuste es por mes, no acumulado: día 31 -> 31 ene, 28/29 feb, 31 mar, 30 abr...
			LocalDate d = mes.atDay(Math.min(regla.diaMes(), mes.lengthOfMonth()));
			if (!d.isBefore(hoy) && !agregar(regla, d, fechas)) {
				return;
			}
			mes = mes.plusMonths(1);
		}
	}

	/** Suma la fecha si todavía entra; devuelve false cuando hay que parar (llegó el final). */
	private static boolean agregar(Regla regla, LocalDate d, List<LocalDate> fechas) {
		if (regla.hasta() != null && d.isAfter(regla.hasta())) {
			return false;
		}
		if (fechas.size() >= TOPE) {
			throw new SerieEventoInvalidaException("La serie generaría más de " + TOPE
					+ " eventos; el máximo es " + TOPE + ": elige un final más cercano");
		}
		fechas.add(d);
		return regla.repeticiones() == null || fechas.size() < regla.repeticiones();
	}

	/**
	 * Inicio y fin de la ocurrencia del día {@code d}, en hora local de la zona. Si la hora de fin no es posterior a la de
	 * inicio, termina al día siguiente. En un cambio de horario la hora local se mantiene (cambia el instante UTC); si el
	 * hueco hace que el fin no quede después del inicio, se usa la duración nominal.
	 */
	static Ocurrencia tramo(LocalDate d, LocalTime horaInicio, LocalTime horaFin, ZoneId zona) {
		LocalDate diaFin = horaFin.isAfter(horaInicio) ? d : d.plusDays(1);
		ZonedDateTime inicio = ZonedDateTime.of(d, horaInicio, zona);
		ZonedDateTime fin = ZonedDateTime.of(diaFin, horaFin, zona);
		if (!fin.isAfter(inicio)) {
			fin = inicio.plus(Duration.between(LocalDateTime.of(d, horaInicio), LocalDateTime.of(diaFin, horaFin)));
		}
		return new Ocurrencia(d, inicio.toOffsetDateTime(), fin.toOffsetDateTime());
	}

	/** Instante del recordatorio de una ocurrencia, o null si ya pasó (el límite exacto cuenta como pasado). */
	public static OffsetDateTime instanteRecordatorio(OffsetDateTime inicio, int minutosAntes, OffsetDateTime ahora) {
		OffsetDateTime instante = inicio.minus(minutosAntes, ChronoUnit.MINUTES);
		return instante.isAfter(ahora) ? instante : null;
	}
}
