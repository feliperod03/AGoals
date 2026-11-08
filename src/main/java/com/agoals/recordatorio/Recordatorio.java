package com.agoals.recordatorio;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;

@Entity
@Table(name = "recordatorio")
public class Recordatorio {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(name = "usuario_id", nullable = false)
	private Long usuarioId;

	// De una tarea, de un evento o suelto (ninguno), nunca de ambos (CHECK en la base). Cada uno es UNIQUE:
	// máximo un recordatorio por tarea y por evento. Se borran en cascada con la tarea / el evento (ON DELETE CASCADE).
	@Column(name = "tarea_id")
	private Long tareaId;

	@Column(name = "evento_id")
	private Long eventoId;

	@Column(name = "fecha_hora", nullable = false)
	private OffsetDateTime fechaHora;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 10)
	private Canal canal = Canal.APP;

	@Column(nullable = false)
	private boolean enviado = false;

	// En la base es NOT NULL DEFAULT '': nunca se guarda null.
	@Column(nullable = false)
	private String descripcion = "";

	public Recordatorio() {
	}

	public Long getId() { return id; }

	public Long getUsuarioId() { return usuarioId; }
	public void setUsuarioId(Long usuarioId) { this.usuarioId = usuarioId; }

	public Long getTareaId() { return tareaId; }
	public void setTareaId(Long tareaId) { this.tareaId = tareaId; }

	public Long getEventoId() { return eventoId; }
	public void setEventoId(Long eventoId) { this.eventoId = eventoId; }

	public OffsetDateTime getFechaHora() { return fechaHora; }
	public void setFechaHora(OffsetDateTime fechaHora) { this.fechaHora = fechaHora; }

	public Canal getCanal() { return canal; }
	public void setCanal(Canal canal) { this.canal = canal; }

	public boolean isEnviado() { return enviado; }
	public void setEnviado(boolean enviado) { this.enviado = enviado; }

	public String getDescripcion() { return descripcion; }
	public void setDescripcion(String descripcion) { this.descripcion = descripcion; }

	@Override
	public boolean equals(Object o) {
		if (this == o) return true;
		if (!(o instanceof Recordatorio other)) return false;
		return id != null && id.equals(other.id);
	}

	@Override
	public int hashCode() {
		return getClass().hashCode();
	}
}
