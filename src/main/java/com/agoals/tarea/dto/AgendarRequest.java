package com.agoals.tarea.dto;

import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

/**
 * Agendar una tarea: {@code fecha} es el día nuevo, {@code hoy} el "hoy" del cliente (define qué está atrasado),
 * {@code incluirSubtareas} (opcional, por defecto true) incluye a sus descendientes candidatos.
 */
public record AgendarRequest(@NotNull LocalDate fecha, @NotNull LocalDate hoy, Boolean incluirSubtareas) {
}
