package com.agoals.common;

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

import java.util.List;

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

	@ExceptionHandler(MethodArgumentNotValidException.class)
	public ResponseEntity<ErrorResponse> validacion(MethodArgumentNotValidException e) {
		List<String> errores = e.getBindingResult().getFieldErrors().stream()
				.map(fe -> fe.getField() + ": " + fe.getDefaultMessage())
				.toList();
		return ResponseEntity.badRequest().body(new ErrorResponse("Datos inválidos", errores));
	}
}
