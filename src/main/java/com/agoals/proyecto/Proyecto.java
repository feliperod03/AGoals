package com.agoals.proyecto;

import com.agoals.common.Estado;
import com.agoals.common.Prioridad;
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

import java.time.OffsetDateTime;

@Entity
@Table(name = "proyecto")
public class Proyecto {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(name = "usuario_id", nullable = false)
	private Long usuarioId;

	@Column(name = "padre_id")
	private Long padreId;

	// Id simple: Objetivo llega en la rebanada 4b; hasta entonces la FK de la base es la única barrera.
	@Column(name = "objetivo_id")
	private Long objetivoId;

	@Column(nullable = false, length = 150)
	private String nombre;

	// En la base es NOT NULL DEFAULT '': nunca se guarda null.
	@Column(nullable = false)
	private String descripcion = "";

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 20)
	private Estado estado = Estado.PENDIENTE;

	@Enumerated(EnumType.STRING)
	@Column(length = 10)
	private Prioridad prioridad;

	// La pone la base de datos (DEFAULT now()); @Generated hace que Hibernate la relea tras el insert.
	@Generated(event = EventType.INSERT)
	@Column(name = "fecha_creacion", insertable = false, updatable = false)
	private OffsetDateTime fechaCreacion;

	public Proyecto() {
	}

	public Long getId() { return id; }

	public Long getUsuarioId() { return usuarioId; }
	public void setUsuarioId(Long usuarioId) { this.usuarioId = usuarioId; }

	public Long getPadreId() { return padreId; }
	public void setPadreId(Long padreId) { this.padreId = padreId; }

	public Long getObjetivoId() { return objetivoId; }
	public void setObjetivoId(Long objetivoId) { this.objetivoId = objetivoId; }

	public String getNombre() { return nombre; }
	public void setNombre(String nombre) { this.nombre = nombre; }

	public String getDescripcion() { return descripcion; }
	public void setDescripcion(String descripcion) { this.descripcion = descripcion; }

	public Estado getEstado() { return estado; }
	public void setEstado(Estado estado) { this.estado = estado; }

	public Prioridad getPrioridad() { return prioridad; }
	public void setPrioridad(Prioridad prioridad) { this.prioridad = prioridad; }

	public OffsetDateTime getFechaCreacion() { return fechaCreacion; }

	@Override
	public boolean equals(Object o) {
		if (this == o) return true;
		if (!(o instanceof Proyecto other)) return false;
		return id != null && id.equals(other.id);
	}

	@Override
	public int hashCode() {
		return getClass().hashCode();
	}
}
