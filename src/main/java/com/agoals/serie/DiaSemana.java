package com.agoals.serie;

import java.time.DayOfWeek;

/** Días de la semana en español para la API (igual que Prioridad); el orden es el de la semana, lunes primero. */
public enum DiaSemana {
	LUNES(DayOfWeek.MONDAY),
	MARTES(DayOfWeek.TUESDAY),
	MIERCOLES(DayOfWeek.WEDNESDAY),
	JUEVES(DayOfWeek.THURSDAY),
	VIERNES(DayOfWeek.FRIDAY),
	SABADO(DayOfWeek.SATURDAY),
	DOMINGO(DayOfWeek.SUNDAY);

	private final DayOfWeek dayOfWeek;

	DiaSemana(DayOfWeek dayOfWeek) {
		this.dayOfWeek = dayOfWeek;
	}

	public DayOfWeek aDayOfWeek() {
		return dayOfWeek;
	}
}
