package com.agoals.usuario;

import org.springframework.security.core.CredentialsContainer;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.io.Serializable;
import java.util.Collection;
import java.util.List;

/**
 * Principal que vive en la sesión: lleva el id, el nombre y el email. El hash se borra después de autenticar
 * (CredentialsContainer), así que en la sesión nunca queda guardado.
 */
public class UsuarioAutenticado implements UserDetails, CredentialsContainer, Serializable {

	private static final long serialVersionUID = 1L;

	private final Long id;
	private final String nombreUsuario;
	private final String email;
	private String contrasenaHash;

	public UsuarioAutenticado(Long id, String nombreUsuario, String email, String contrasenaHash) {
		this.id = id;
		this.nombreUsuario = nombreUsuario;
		this.email = email;
		this.contrasenaHash = contrasenaHash;
	}

	public Long getId() { return id; }
	public String getNombreUsuario() { return nombreUsuario; }
	public String getEmail() { return email; }

	@Override
	public Collection<? extends GrantedAuthority> getAuthorities() {
		return List.of();
	}

	@Override
	public String getPassword() {
		return contrasenaHash;
	}

	@Override
	public String getUsername() {
		return email;
	}

	@Override
	public void eraseCredentials() {
		this.contrasenaHash = null;
	}
}
