package com.agoals.usuario;

import com.agoals.usuario.dto.UsuarioResponse;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Service
@Transactional(readOnly = true)
public class UsuarioService implements UserDetailsService {

	/** Hash que dejó la migración V2 en el usuario por defecto: significa "todavía sin contraseña". */
	static final String HASH_SIN_LOGIN = "sin-login-v1";
	static final long ID_USUARIO_POR_DEFECTO = 1L;

	public enum ResultadoClaveInicial {
		/** Se guardó el hash de la contraseña (y el email, si venía). */
		FIJADA,
		/** Igual que FIJADA, pero el email pedido ya lo tiene otro usuario: se dejó el que había. */
		FIJADA_EMAIL_OCUPADO,
		/** El usuario ya tiene una contraseña real: no se toca nada (haya o no variable). */
		YA_TENIA_CLAVE,
		/** El usuario 1 sigue sin contraseña y no hay variable para fijarla: no se hace nada (el arranque avisa). */
		SIN_VARIABLE,
		/** No existe el usuario 1. */
		SIN_USUARIO
	}

	private final UsuarioRepository repository;
	private final PasswordEncoder passwordEncoder;

	public UsuarioService(UsuarioRepository repository, PasswordEncoder passwordEncoder) {
		this.repository = repository;
		this.passwordEncoder = passwordEncoder;
	}

	/** El "username" de Spring Security es el email (P1). Sin distinguir mayúsculas y sin espacios en los bordes. */
	@Override
	public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
		Usuario u = repository.findByEmailIgnoreCase(email == null ? "" : email.trim())
				.orElseThrow(() -> new UsernameNotFoundException("Usuario inexistente"));
		// Sin contraseña todavía: no se puede entrar. Se trata igual que un email inexistente (y evita comparar
		// contra un hash sin formato).
		if (HASH_SIN_LOGIN.equals(u.getContrasenaHash())) {
			throw new UsernameNotFoundException("Usuario sin contraseña");
		}
		return new UsuarioAutenticado(u.getId(), u.getNombreUsuario(), u.getEmail(), u.getContrasenaHash());
	}

	public UsuarioResponse buscar(Long id) {
		Usuario u = repository.findById(id).orElseThrow(UsuarioNoAutenticadoException::new);
		return new UsuarioResponse(u.getId(), u.getNombreUsuario(), u.getEmail());
	}

	/**
	 * Arranque: fija la contraseña (y el email) del usuario 1 SOLO si todavía tiene el hash de V2. Nunca pisa un hash real.
	 * El email se guarda recortado y en minúsculas, igual que se compara en el login.
	 */
	@Transactional
	public ResultadoClaveInicial fijarCredencialesIniciales(Optional<String> clave, Optional<String> email) {
		// Primero el estado del usuario 1: con una contraseña real no hay nada que hacer (haya o no variable), y el aviso
		// de "falta la variable" solo tiene sentido si el usuario sigue sin contraseña.
		Optional<Usuario> encontrado = repository.findById(ID_USUARIO_POR_DEFECTO);
		if (encontrado.isEmpty()) {
			return ResultadoClaveInicial.SIN_USUARIO;
		}
		Usuario u = encontrado.get();
		if (!HASH_SIN_LOGIN.equals(u.getContrasenaHash())) {
			return ResultadoClaveInicial.YA_TENIA_CLAVE;
		}
		String claveLimpia = clave.filter(c -> !c.isBlank()).orElse(null);
		if (claveLimpia == null) {
			return ResultadoClaveInicial.SIN_VARIABLE;
		}
		u.setContrasenaHash(passwordEncoder.encode(claveLimpia));
		ResultadoClaveInicial resultado = ResultadoClaveInicial.FIJADA;
		String emailNuevo = email.map(e -> e.trim().toLowerCase()).filter(e -> !e.isEmpty()).orElse(null);
		if (emailNuevo != null) {
			boolean ocupado = repository.findByEmailIgnoreCase(emailNuevo)
					.filter(otro -> !otro.getId().equals(u.getId())).isPresent();
			if (ocupado) {
				resultado = ResultadoClaveInicial.FIJADA_EMAIL_OCUPADO;
			} else {
				u.setEmail(emailNuevo);
			}
		}
		repository.save(u);
		return resultado;
	}
}
