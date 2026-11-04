package com.agoals.tarea;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.Generated;
import org.hibernate.generator.EventType;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;

@Entity
@Table(name = "tarea")
public class Tarea {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(name = "usuario_id", nullable = false)
	private Long usuarioId;

	@Column(name = "padre_id")
	private Long padreId;

	@Column(nullable = false, length = 200)
	private String titulo;

	private String descripcion;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 20)
	private Estado estado = Estado.PENDIENTE;

	@Enumerated(EnumType.STRING)
	@Column(length = 10)
	private Prioridad prioridad;

	private LocalDate fecha;

	@Column(name = "hora_inicio")
	private LocalTime horaInicio;

	@Column(name = "hora_fin")
	private LocalTime horaFin;

	@Column(name = "veces_pospuesta", nullable = false)
	private int vecesPospuesta;

	// La pone la base de datos (DEFAULT now()); @Generated hace que Hibernate la relea tras el insert.
	@Generated(event = EventType.INSERT)
	@Column(name = "fecha_creacion", insertable = false, updatable = false)
	private OffsetDateTime fechaCreacion;

	public Tarea() {
	}

	public Long getId() { return id; }

	public Long getUsuarioId() { return usuarioId; }
	public void setUsuarioId(Long usuarioId) { this.usuarioId = usuarioId; }

	public Long getPadreId() { return padreId; }
	public void setPadreId(Long padreId) { this.padreId = padreId; }

	public String getTitulo() { return titulo; }
	public void setTitulo(String titulo) { this.titulo = titulo; }

	public String getDescripcion() { return descripcion; }
	public void setDescripcion(String descripcion) { this.descripcion = descripcion; }

	public Estado getEstado() { return estado; }
	public void setEstado(Estado estado) { this.estado = estado; }

	public Prioridad getPrioridad() { return prioridad; }
	public void setPrioridad(Prioridad prioridad) { this.prioridad = prioridad; }

	public LocalDate getFecha() { return fecha; }
	public void setFecha(LocalDate fecha) { this.fecha = fecha; }

	public LocalTime getHoraInicio() { return horaInicio; }
	public void setHoraInicio(LocalTime horaInicio) { this.horaInicio = horaInicio; }

	public LocalTime getHoraFin() { return horaFin; }
	public void setHoraFin(LocalTime horaFin) { this.horaFin = horaFin; }

	public int getVecesPospuesta() { return vecesPospuesta; }

	public OffsetDateTime getFechaCreacion() { return fechaCreacion; }

	@Override
	public boolean equals(Object o) {
		if (this == o) return true;
		if (!(o instanceof Tarea other)) return false;
		return id != null && id.equals(other.id);
	}

	@Override
	public int hashCode() {
		return getClass().hashCode();
	}
}
