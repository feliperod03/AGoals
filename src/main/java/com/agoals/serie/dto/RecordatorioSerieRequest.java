package com.agoals.serie.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

/** Recordatorio de cada ocurrencia, con el mismo desfase para todas. {@code minutosAntes} null = 60. */
public record RecordatorioSerieRequest(
		@Min(0) @Max(10080) Integer minutosAntes) {

	public static final int POR_DEFECTO = 60;

	public int minutos() {
		return minutosAntes != null ? minutosAntes : POR_DEFECTO;
	}
}
