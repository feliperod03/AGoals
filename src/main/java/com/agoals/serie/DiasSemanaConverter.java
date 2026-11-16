package com.agoals.serie;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

import java.util.Arrays;
import java.util.EnumSet;
import java.util.Set;
import java.util.stream.Collectors;

/** Guarda el conjunto de días como texto legible ('LUNES,MIERCOLES'), siempre en el orden de la semana. */
@Converter
public class DiasSemanaConverter implements AttributeConverter<Set<DiaSemana>, String> {

	@Override
	public String convertToDatabaseColumn(Set<DiaSemana> dias) {
		if (dias == null || dias.isEmpty()) {
			return null;
		}
		return EnumSet.copyOf(dias).stream().map(Enum::name).collect(Collectors.joining(","));
	}

	@Override
	public Set<DiaSemana> convertToEntityAttribute(String texto) {
		if (texto == null || texto.isBlank()) {
			return null;
		}
		return Arrays.stream(texto.split(",")).map(String::trim).map(DiaSemana::valueOf)
				.collect(Collectors.toCollection(() -> EnumSet.noneOf(DiaSemana.class)));
	}
}
