package com.agoals.idea;

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
@Table(name = "idea")
public class Idea {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(name = "usuario_id", nullable = false)
	private Long usuarioId;

	// Libre, o ligada a un proyecto O a un objetivo (la base lo exige con un CHECK).
	@Column(name = "proyecto_id")
	private Long proyectoId;

	@Column(name = "objetivo_id")
	private Long objetivoId;

	@Column(nullable = false, length = 200)
	private String titulo;

	// En la base es NOT NULL DEFAULT '': nunca se guarda null.
	@Column(nullable = false)
	private String descripcion = "";

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 20)
	private EstadoIdea estado = EstadoIdea.PLANTEADA;

	private String conclusion;

	// La pone la base de datos (DEFAULT now()); @Generated hace que Hibernate la relea tras el insert.
	@Generated(event = EventType.INSERT)
	@Column(name = "fecha_creacion", insertable = false, updatable = false)
	private OffsetDateTime fechaCreacion;

	@Column(name = "fecha_cierre")
	private OffsetDateTime fechaCierre;

	public Idea() {
	}

	public Long getId() { return id; }

	public Long getUsuarioId() { return usuarioId; }
	public void setUsuarioId(Long usuarioId) { this.usuarioId = usuarioId; }

	public Long getProyectoId() { return proyectoId; }
	public void setProyectoId(Long proyectoId) { this.proyectoId = proyectoId; }

	public Long getObjetivoId() { return objetivoId; }
	public void setObjetivoId(Long objetivoId) { this.objetivoId = objetivoId; }

	public String getTitulo() { return titulo; }
	public void setTitulo(String titulo) { this.titulo = titulo; }

	public String getDescripcion() { return descripcion; }
	public void setDescripcion(String descripcion) { this.descripcion = descripcion; }

	public EstadoIdea getEstado() { return estado; }
	public void setEstado(EstadoIdea estado) { this.estado = estado; }

	public String getConclusion() { return conclusion; }
	public void setConclusion(String conclusion) { this.conclusion = conclusion; }

	public OffsetDateTime getFechaCreacion() { return fechaCreacion; }

	public OffsetDateTime getFechaCierre() { return fechaCierre; }
	public void setFechaCierre(OffsetDateTime fechaCierre) { this.fechaCierre = fechaCierre; }

	@Override
	public boolean equals(Object o) {
		if (this == o) return true;
		if (!(o instanceof Idea other)) return false;
		return id != null && id.equals(other.id);
	}

	@Override
	public int hashCode() {
		return getClass().hashCode();
	}
}
