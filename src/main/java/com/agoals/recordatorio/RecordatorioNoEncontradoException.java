package com.agoals.recordatorio;

public class RecordatorioNoEncontradoException extends RuntimeException {

	public RecordatorioNoEncontradoException(Long id) {
		super("No existe el recordatorio con id " + id);
	}
}
