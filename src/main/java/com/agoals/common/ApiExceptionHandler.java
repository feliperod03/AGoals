package com.agoals.common;

import com.agoals.evento.EventoInvalidoException;
import com.agoals.evento.EventoNoEncontradoException;
import com.agoals.idea.IdeaEstadoInvalidaException;
import com.agoals.idea.IdeaInvalidaException;
import com.agoals.idea.IdeaNoEncontradaException;
import com.agoals.objetivo.ObjetivoConDependenciasException;
import com.agoals.objetivo.ObjetivoInvalidoException;
import com.agoals.objetivo.ObjetivoNoEncontradoException;
import com.agoals.proyecto.ProyectoConDependenciasException;
import com.agoals.proyecto.ProyectoInvalidoException;
import com.agoals.proyecto.ProyectoNoEncontradoException;
import com.agoals.tarea.TareaConDependenciasException;
import com.agoals.tarea.TareaEstadoInvalidaException;
import com.agoals.tarea.TareaInvalidaException;
import com.agoals.tarea.TareaNoEncontradaException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

@RestControllerAdvice
public class ApiExceptionHandler {

	public record ErrorResponse(String mensaje, List<String> errores) {
	}

	@ExceptionHandler(TareaNoEncontradaException.class)
	public ResponseEntity<ErrorResponse> noEncontrada(TareaNoEncontradaException e) {
		return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ErrorResponse(e.getMessage(), List.of()));
	}

	@ExceptionHandler(TareaInvalidaException.class)
	public ResponseEntity<ErrorResponse> invalida(TareaInvalidaException e) {
		return ResponseEntity.badRequest().body(new ErrorResponse(e.getMessage(), List.of()));
	}

	@ExceptionHandler(TareaConDependenciasException.class)
	public ResponseEntity<ErrorResponse> tareaConDependencias(TareaConDependenciasException e) {
		return ResponseEntity.status(HttpStatus.CONFLICT).body(new ErrorResponse(e.getMessage(), List.of()));
	}

	@ExceptionHandler(TareaEstadoInvalidaException.class)
	public ResponseEntity<ErrorResponse> estadoInvalido(TareaEstadoInvalidaException e) {
		return ResponseEntity.status(HttpStatus.CONFLICT).body(new ErrorResponse(e.getMessage(), List.of()));
	}

	@ExceptionHandler(ProyectoNoEncontradoException.class)
	public ResponseEntity<ErrorResponse> proyectoNoEncontrado(ProyectoNoEncontradoException e) {
		return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ErrorResponse(e.getMessage(), List.of()));
	}

	@ExceptionHandler(ProyectoInvalidoException.class)
	public ResponseEntity<ErrorResponse> proyectoInvalido(ProyectoInvalidoException e) {
		return ResponseEntity.badRequest().body(new ErrorResponse(e.getMessage(), List.of()));
	}

	@ExceptionHandler(ProyectoConDependenciasException.class)
	public ResponseEntity<ErrorResponse> proyectoConDependencias(ProyectoConDependenciasException e) {
		return ResponseEntity.status(HttpStatus.CONFLICT).body(new ErrorResponse(e.getMessage(), List.of()));
	}

	@ExceptionHandler(ObjetivoNoEncontradoException.class)
	public ResponseEntity<ErrorResponse> objetivoNoEncontrado(ObjetivoNoEncontradoException e) {
		return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ErrorResponse(e.getMessage(), List.of()));
	}

	@ExceptionHandler(ObjetivoInvalidoException.class)
	public ResponseEntity<ErrorResponse> objetivoInvalido(ObjetivoInvalidoException e) {
		return ResponseEntity.badRequest().body(new ErrorResponse(e.getMessage(), List.of()));
	}

	@ExceptionHandler(ObjetivoConDependenciasException.class)
	public ResponseEntity<ErrorResponse> objetivoConDependencias(ObjetivoConDependenciasException e) {
		return ResponseEntity.status(HttpStatus.CONFLICT).body(new ErrorResponse(e.getMessage(), List.of()));
	}

	@ExceptionHandler(IdeaNoEncontradaException.class)
	public ResponseEntity<ErrorResponse> ideaNoEncontrada(IdeaNoEncontradaException e) {
		return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ErrorResponse(e.getMessage(), List.of()));
	}

	@ExceptionHandler(IdeaInvalidaException.class)
	public ResponseEntity<ErrorResponse> ideaInvalida(IdeaInvalidaException e) {
		return ResponseEntity.badRequest().body(new ErrorResponse(e.getMessage(), List.of()));
	}

	@ExceptionHandler(IdeaEstadoInvalidaException.class)
	public ResponseEntity<ErrorResponse> ideaEstadoInvalido(IdeaEstadoInvalidaException e) {
		return ResponseEntity.status(HttpStatus.CONFLICT).body(new ErrorResponse(e.getMessage(), List.of()));
	}

	@ExceptionHandler(EventoNoEncontradoException.class)
	public ResponseEntity<ErrorResponse> eventoNoEncontrado(EventoNoEncontradoException e) {
		return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ErrorResponse(e.getMessage(), List.of()));
	}

	@ExceptionHandler(EventoInvalidoException.class)
	public ResponseEntity<ErrorResponse> eventoInvalido(EventoInvalidoException e) {
		return ResponseEntity.badRequest().body(new ErrorResponse(e.getMessage(), List.of()));
	}

	// Un parámetro de URL con tipo inválido (p. ej. ?estado=RARO o ?fecha=06-11-2026): 400 con mensaje claro.
	@ExceptionHandler(MethodArgumentTypeMismatchException.class)
	public ResponseEntity<ErrorResponse> parametroInvalido(MethodArgumentTypeMismatchException e) {
		String mensaje = "Valor inválido para '" + e.getName() + "': '" + e.getValue() + "'";
		Class<?> tipo = e.getRequiredType();
		if (tipo != null && tipo.isEnum()) {
			mensaje += ". Valores válidos: " + Arrays.stream(tipo.getEnumConstants())
					.map(c -> ((Enum<?>) c).name())
					.collect(Collectors.joining(", "));
		}
		return ResponseEntity.badRequest().body(new ErrorResponse(mensaje, List.of()));
	}

	@ExceptionHandler(MethodArgumentNotValidException.class)
	public ResponseEntity<ErrorResponse> validacion(MethodArgumentNotValidException e) {
		List<String> errores = e.getBindingResult().getFieldErrors().stream()
				.map(fe -> fe.getField() + ": " + fe.getDefaultMessage())
				.toList();
		return ResponseEntity.badRequest().body(new ErrorResponse("Datos inválidos", errores));
	}
}
