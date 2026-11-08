package com.agoals.recordatorio;

import com.agoals.common.ApiExceptionHandler.ErrorResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import tools.jackson.databind.exc.InvalidFormatException;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Mensaje claro para un cuerpo que Jackson no puede leer (p. ej. {@code "canal": "raro"}). Sin esto Spring responde
 * 400 con el cuerpo vacío. Está limitado a RecordatorioController a propósito: así no cambia la respuesta de los
 * endpoints de los otros módulos.
 */
@RestControllerAdvice(assignableTypes = RecordatorioController.class)
public class RecordatorioExceptionHandler {

	@ExceptionHandler(HttpMessageNotReadableException.class)
	public ResponseEntity<ErrorResponse> cuerpoNoLegible(HttpMessageNotReadableException e) {
		String mensaje = "El cuerpo de la petición no es válido";
		if (e.getCause() instanceof InvalidFormatException f && !f.getPath().isEmpty()) {
			String campo = f.getPath().get(f.getPath().size() - 1).getPropertyName();
			mensaje = "Valor inválido para '" + campo + "': '" + f.getValue() + "'";
			Class<?> tipo = f.getTargetType();
			if (tipo != null && tipo.isEnum()) {
				mensaje += ". Valores válidos: " + Arrays.stream(tipo.getEnumConstants())
						.map(c -> ((Enum<?>) c).name())
						.collect(Collectors.joining(", "));
			}
		}
		return ResponseEntity.badRequest().body(new ErrorResponse(mensaje, List.of()));
	}
}
