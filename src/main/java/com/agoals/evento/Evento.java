package com.agoals.evento;

import com.agoals.common.Prioridad;
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
@Table(name = "evento")
public class Evento {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(name = "usuario_id", nullable = false)
	private Long usuarioId;

	@Column(nullable = false, length = 200)
	private String titulo;

	// En la base es NOT NULL DEFAULT '': nunca se guarda null.
	@Column(nullable = false)
	private String descripcion = "";

	// Instantes (TIMESTAMPTZ): el desfase con el que llegó la fecha no se conserva, solo el momento.
	@Column(name = "fecha_hora_inicio", nullable = false)
	private OffsetDateTime fechaHoraInicio;

	// La base exige fin > inicio con un CHECK (red de seguridad de la validación del service).
	@Column(name = "fecha_hora_fin", nullable = false)
	private OffsetDateTime fechaHoraFin;

	@Enumerated(EnumType.STRING)
	@Column(length = 10)
	private Prioridad prioridad;

	public Evento() {
	}

	public Long getId() { return id; }

	public Long getUsuarioId() { return usuarioId; }
	public void setUsuarioId(Long usuarioId) { this.usuarioId = usuarioId; }

	public String getTitulo() { return titulo; }
	public void setTitulo(String titulo) { this.titulo = titulo; }

	public String getDescripcion() { return descripcion; }
	public void setDescripcion(String descripcion) { this.descripcion = descripcion; }

	public OffsetDateTime getFechaHoraInicio() { return fechaHoraInicio; }
	public void setFechaHoraInicio(OffsetDateTime fechaHoraInicio) { this.fechaHoraInicio = fechaHoraInicio; }

	public OffsetDateTime getFechaHoraFin() { return fechaHoraFin; }
	public void setFechaHoraFin(OffsetDateTime fechaHoraFin) { this.fechaHoraFin = fechaHoraFin; }

	public Prioridad getPrioridad() { return prioridad; }
	public void setPrioridad(Prioridad prioridad) { this.prioridad = prioridad; }

	@Override
	public boolean equals(Object o) {
		if (this == o) return true;
		if (!(o instanceof Evento other)) return false;
		return id != null && id.equals(other.id);
	}

	@Override
	public int hashCode() {
		return getClass().hashCode();
	}
}
