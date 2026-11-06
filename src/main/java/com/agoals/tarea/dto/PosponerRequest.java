package com.agoals.tarea.dto;

import java.time.LocalDate;

/** Nueva fecha opcional; si falta (o no hay body), se pospone al día siguiente. */
public record PosponerRequest(LocalDate fecha) {
}
