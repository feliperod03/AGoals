package com.agoals.serie;

import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDate;
import java.util.Set;

/**
 * La regla de una serie de eventos recurrentes. Los eventos se materializan como filas de `evento` (con serie_id);
 * aquí solo queda la regla, la zona y el final, para poder mostrar "se repite ...".
 */
@Entity
@Table(name = "serie_evento")
public class SerieEvento {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(name = "usuario_id", nullable = false)
	private Long usuarioId;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 10)
	private Frecuencia frecuencia;

	// Solo SEMANAL. En la base: texto 'LUNES,MIERCOLES'.
	@Convert(converter = DiasSemanaConverter.class)
	@Column(name = "dias_semana", length = 80)
	private Set<DiaSemana> diasSemana;

	// Solo SEMANAL (1 o 2). La columna es SMALLINT; en Java se usa Integer (JdbcTypeCode para que `validate` coincida).
	@JdbcTypeCode(SqlTypes.SMALLINT)
	@Column(name = "intervalo_semanas")
	private Integer intervaloSemanas;

	// Solo MENSUAL (1..31). SMALLINT, igual que arriba.
	@JdbcTypeCode(SqlTypes.SMALLINT)
	@Column(name = "dia_mes")
	private Integer diaMes;

	// Primera ocurrencia: ancla de "cada 2 semanas".
	@Column(name = "fecha_inicio", nullable = false)
	private LocalDate fechaInicio;

	// Exactamente uno de los dos finales (CHECK en la base).
	@Column
	private LocalDate hasta;

	@Column
	private Integer repeticiones;

	@Column(name = "zona_horaria", nullable = false, length = 50)
	private String zonaHoraria;

	public SerieEvento() {
	}

	public Long getId() { return id; }

	public Long getUsuarioId() { return usuarioId; }
	public void setUsuarioId(Long usuarioId) { this.usuarioId = usuarioId; }

	public Frecuencia getFrecuencia() { return frecuencia; }
	public void setFrecuencia(Frecuencia frecuencia) { this.frecuencia = frecuencia; }

	public Set<DiaSemana> getDiasSemana() { return diasSemana; }
	public void setDiasSemana(Set<DiaSemana> diasSemana) { this.diasSemana = diasSemana; }

	public Integer getIntervaloSemanas() { return intervaloSemanas; }
	public void setIntervaloSemanas(Integer intervaloSemanas) { this.intervaloSemanas = intervaloSemanas; }

	public Integer getDiaMes() { return diaMes; }
	public void setDiaMes(Integer diaMes) { this.diaMes = diaMes; }

	public LocalDate getFechaInicio() { return fechaInicio; }
	public void setFechaInicio(LocalDate fechaInicio) { this.fechaInicio = fechaInicio; }

	public LocalDate getHasta() { return hasta; }
	public void setHasta(LocalDate hasta) { this.hasta = hasta; }

	public Integer getRepeticiones() { return repeticiones; }
	public void setRepeticiones(Integer repeticiones) { this.repeticiones = repeticiones; }

	public String getZonaHoraria() { return zonaHoraria; }
	public void setZonaHoraria(String zonaHoraria) { this.zonaHoraria = zonaHoraria; }

	@Override
	public boolean equals(Object o) {
		if (this == o) return true;
		if (!(o instanceof SerieEvento other)) return false;
		return id != null && id.equals(other.id);
	}

	@Override
	public int hashCode() {
		return getClass().hashCode();
	}
}
