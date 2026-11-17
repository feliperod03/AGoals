package com.agoals.usuario;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

/** Solo lo usa UsuarioService (regla 2: ningún otro módulo toca este repository). */
public interface UsuarioRepository extends JpaRepository<Usuario, Long> {

	Optional<Usuario> findByEmailIgnoreCase(String email);
}
