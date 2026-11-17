package com.agoals.usuario;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.util.Objects;

@Entity
@Table(name = "usuario")
public class Usuario {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(name = "nombre_usuario", nullable = false, length = 50)
	private String nombreUsuario;

	@Column(nullable = false)
	private String email;

	// Nunca la contraseña en claro: hash del PasswordEncoder delegado ({bcrypt}...).
	@Column(name = "contrasena_hash", nullable = false)
	private String contrasenaHash;

	@Column(name = "zona_horaria", nullable = false, length = 50)
	private String zonaHoraria;

	public Usuario() {
	}

	public Long getId() { return id; }

	public String getNombreUsuario() { return nombreUsuario; }
	public void setNombreUsuario(String nombreUsuario) { this.nombreUsuario = nombreUsuario; }

	public String getEmail() { return email; }
	public void setEmail(String email) { this.email = email; }

	public String getContrasenaHash() { return contrasenaHash; }
	public void setContrasenaHash(String contrasenaHash) { this.contrasenaHash = contrasenaHash; }

	public String getZonaHoraria() { return zonaHoraria; }
	public void setZonaHoraria(String zonaHoraria) { this.zonaHoraria = zonaHoraria; }

	@Override
	public boolean equals(Object o) {
		if (this == o) return true;
		if (!(o instanceof Usuario otro)) return false;
		return id != null && Objects.equals(id, otro.id);
	}

	@Override
	public int hashCode() {
		return Usuario.class.hashCode();
	}
}
